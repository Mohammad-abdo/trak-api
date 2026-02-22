import * as repo from '../repositories/promotionRepository.js';

const DiscountType = { PERCENTAGE: 'PERCENTAGE', FIXED: 'FIXED' };
const BookingType = { RIDE: 'RIDE', DEDICATED: 'DEDICATED', ALL: 'ALL' };

/**
 * Apply a promotion to a price. Used by pricing engine (ride + dedicated).
 * If code is provided, only that promotion is considered; otherwise first applicable is used.
 * Does NOT record usage here – caller should call recordPromotionUsage after booking is confirmed.
 *
 * @param {Object} params
 * @param {number} params.userId
 * @param {string} params.bookingType - RIDE | DEDICATED
 * @param {number|null} params.vehicleCategoryId
 * @param {number} params.totalPrice
 * @param {Date|string} params.bookingDate - date/time of booking for time-window check
 * @param {string|null} params.code - optional specific code
 * @returns {{ discount: number, finalPrice: number, promotion: object|null, applied: boolean }}
 */
export async function applyPromotion({ userId, bookingType, vehicleCategoryId, totalPrice, bookingDate, code = null }) {
  const at = bookingDate ? new Date(bookingDate) : new Date();
  const applicable = await repo.findApplicable({
    bookingType,
    vehicleCategoryId: vehicleCategoryId ?? undefined,
    at,
    code: code || undefined,
  });

  if (applicable.length === 0) {
    return { discount: 0, finalPrice: totalPrice, promotion: null, applied: false };
  }

  // Single promotion only (no stacking)
  const promotion = applicable[0];

  // Per-user limit
  if (promotion.usagePerUser != null) {
    const usedByUser = await repo.countUsagesByUserForPromotion(promotion.id, userId);
    if (usedByUser >= promotion.usagePerUser) {
      return { discount: 0, finalPrice: totalPrice, promotion: null, applied: false };
    }
  }

  let discount = 0;
  if (promotion.discountType === DiscountType.PERCENTAGE) {
    const pct = Math.min(100, Math.max(0, promotion.discountValue));
    discount = Math.round((totalPrice * pct) / 100 * 100) / 100;
  } else {
    discount = Math.min(promotion.discountValue, totalPrice);
    discount = Math.round(discount * 100) / 100;
  }

  const finalPrice = Math.max(0, Math.round((totalPrice - discount) * 100) / 100);

  return {
    discount,
    finalPrice,
    promotion: {
      id: promotion.id,
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
    },
    applied: true,
  };
}

/**
 * Record that a promotion was used for a booking. Call after booking is created.
 */
export async function recordPromotionUsage(promotionId, userId, bookingId = null) {
  return repo.recordUsage(promotionId, userId, bookingId);
}

/**
 * Validate a coupon/promotion for display (discount & final price). Does not record usage.
 */
export async function validatePromotion({ code, bookingType, categoryId, estimatedPrice }) {
  const promotion = await repo.findByCode(code);
  if (!promotion) {
    return { valid: false, message: 'PROMOTION_NOT_FOUND', discount: 0, finalPrice: estimatedPrice };
  }
  if (!promotion.isActive) {
    return { valid: false, message: 'PROMOTION_INACTIVE', discount: 0, finalPrice: estimatedPrice };
  }
  const now = new Date();
  if (now < new Date(promotion.startDate)) {
    return { valid: false, message: 'PROMOTION_NOT_STARTED', discount: 0, finalPrice: estimatedPrice };
  }
  if (now > new Date(promotion.endDate)) {
    return { valid: false, message: 'PROMOTION_EXPIRED', discount: 0, finalPrice: estimatedPrice };
  }
  const bookingTypeOk = promotion.bookingType === BookingType.ALL || promotion.bookingType === bookingType;
  if (!bookingTypeOk) {
    return { valid: false, message: 'PROMOTION_NOT_APPLICABLE_BOOKING_TYPE', discount: 0, finalPrice: estimatedPrice };
  }
  if (categoryId != null && promotion.categories?.length > 0) {
    const hasCategory = promotion.categories.some((c) => c.vehicleCategoryId === categoryId);
    if (!hasCategory) {
      return { valid: false, message: 'PROMOTION_NOT_APPLICABLE_CATEGORY', discount: 0, finalPrice: estimatedPrice };
    }
  }

  const usageCount = await repo.countUsagesByPromotion(promotion.id);
  if (promotion.usageLimit != null && usageCount >= promotion.usageLimit) {
    return { valid: false, message: 'PROMOTION_USAGE_LIMIT_REACHED', discount: 0, finalPrice: estimatedPrice };
  }

  const price = Number(estimatedPrice) || 0;
  let discount = 0;
  if (promotion.discountType === DiscountType.PERCENTAGE) {
    const pct = Math.min(100, Math.max(0, promotion.discountValue));
    discount = Math.round((price * pct) / 100 * 100) / 100;
  } else {
    discount = Math.min(promotion.discountValue, price);
    discount = Math.round(discount * 100) / 100;
  }
  const finalPrice = Math.max(0, Math.round((price - discount) * 100) / 100);

  return {
    valid: true,
    discount,
    finalPrice,
    promotion: {
      id: promotion.id,
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
    },
  };
}

export async function createPromotion(data) {
  const code = (data.code || '').trim().toUpperCase();
  if (!code) throw new Error('CODE_REQUIRED');
  const existing = await repo.findByCode(code);
  if (existing) throw new Error('PROMOTION_CODE_EXISTS');

  if (data.discountType === DiscountType.PERCENTAGE && (data.discountValue < 0 || data.discountValue > 100)) {
    throw new Error('PERCENTAGE_DISCOUNT_INVALID');
  }
  if (data.discountType === DiscountType.FIXED && data.discountValue < 0) {
    throw new Error('FIXED_DISCOUNT_INVALID');
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate < startDate) throw new Error('END_DATE_BEFORE_START_DATE');

  return repo.createPromotion({
    code,
    discountType: data.discountType,
    discountValue: Number(data.discountValue),
    startDate,
    endDate,
    usageLimit: data.usageLimit != null ? parseInt(data.usageLimit, 10) : null,
    usagePerUser: data.usagePerUser != null ? parseInt(data.usagePerUser, 10) : null,
    bookingType: data.bookingType || BookingType.ALL,
    startHour: data.startHour != null ? parseInt(data.startHour, 10) : null,
    endHour: data.endHour != null ? parseInt(data.endHour, 10) : null,
    isActive: data.isActive !== false,
    imageUrl: data.imageUrl || null,
    categoryIds: data.categoryIds || [],
  });
}

export async function listPromotions(filters) {
  return repo.list(filters);
}

export async function getPromotionById(id) {
  const p = await repo.findById(id);
  if (!p) throw new Error('PROMOTION_NOT_FOUND');
  const usageCount = await repo.countUsagesByPromotion(id);
  return { ...p, usageCount };
}

export async function updatePromotion(id, data) {
  const existing = await repo.findById(id);
  if (!existing) throw new Error('PROMOTION_NOT_FOUND');

  if (data.code !== undefined) {
    const code = data.code.trim().toUpperCase();
    const other = await repo.findByCode(code);
    if (other && other.id !== id) throw new Error('PROMOTION_CODE_EXISTS');
    data.code = code;
  }
  if (data.discountType === DiscountType.PERCENTAGE && data.discountValue != null) {
    if (data.discountValue < 0 || data.discountValue > 100) throw new Error('PERCENTAGE_DISCOUNT_INVALID');
  }
  if (data.discountType === DiscountType.FIXED && data.discountValue != null && data.discountValue < 0) {
    throw new Error('FIXED_DISCOUNT_INVALID');
  }
  if (data.startDate) data.startDate = new Date(data.startDate);
  if (data.endDate) data.endDate = new Date(data.endDate);
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    throw new Error('END_DATE_BEFORE_START_DATE');
  }

  return repo.updatePromotion(id, {
    ...data,
    categoryIds: data.categoryIds !== undefined ? data.categoryIds : undefined,
  });
}

export async function deletePromotion(id) {
  const existing = await repo.findById(id);
  if (!existing) throw new Error('PROMOTION_NOT_FOUND');
  return repo.deletePromotion(id);
}

export async function togglePromotion(id) {
  const existing = await repo.findById(id);
  if (!existing) throw new Error('PROMOTION_NOT_FOUND');
  return repo.toggleActive(id, !existing.isActive);
}
