import prisma from '../utils/prisma.js';

export async function createPromotion(data) {
  const { categoryIds, ...rest } = data;
  const promotion = await prisma.promotion.create({
    data: {
      ...rest,
      categories: categoryIds?.length
        ? { create: categoryIds.map((vehicleCategoryId) => ({ vehicleCategoryId })) }
        : undefined,
    },
    include: { categories: { include: { vehicleCategory: { select: { id: true, name: true, nameAr: true } } } } },
  });
  return promotion;
}

export async function findByCode(code) {
  return prisma.promotion.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { categories: true },
  });
}

export async function findById(id) {
  return prisma.promotion.findUnique({
    where: { id },
    include: {
      categories: { include: { vehicleCategory: { select: { id: true, name: true, nameAr: true } } } },
      usages: {
        orderBy: { usedAt: 'desc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, contactNumber: true } } },
      },
    },
  });
}

export async function list(filters = {}) {
  const { page = 1, limit = 20 } = filters;
  const [items, total] = await prisma.$transaction([
    prisma.promotion.findMany({
      include: {
        categories: { include: { vehicleCategory: { select: { id: true, name: true, nameAr: true } } } },
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.promotion.count(),
  ]);
  return { items, total, page, limit };
}

export async function updatePromotion(id, data) {
  const { categoryIds, ...rest } = data;
  if (categoryIds !== undefined) {
    await prisma.promotionCategory.deleteMany({ where: { promotionId: id } });
    if (categoryIds?.length) {
      await prisma.promotionCategory.createMany({
        data: categoryIds.map((vehicleCategoryId) => ({ promotionId: id, vehicleCategoryId })),
      });
    }
  }
  return prisma.promotion.update({
    where: { id },
    data: rest,
    include: { categories: true },
  });
}

export async function deletePromotion(id) {
  return prisma.promotion.delete({ where: { id } });
}

export async function toggleActive(id, isActive) {
  return prisma.promotion.update({
    where: { id },
    data: { isActive },
    include: { categories: true },
  });
}

/** Find active promotions applicable for (bookingType, vehicleCategoryId, now, optional code). */
export async function findApplicable({ bookingType, vehicleCategoryId, at, code = null }) {
  const now = at ? new Date(at) : new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentHour = now.getHours() + now.getMinutes() / 60;

  const where = {
    isActive: true,
    startDate: { lte: now },
    endDate: { gte: now },
    OR: [{ bookingType: 'ALL' }, { bookingType: bookingType }],
  };
  if (code) {
    where.code = code.trim().toUpperCase();
  }

  const promotions = await prisma.promotion.findMany({
    where,
    include: {
      categories: true,
      _count: { select: { usages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return promotions.filter((p) => {
    if (p.usageLimit != null && (p._count?.usages ?? 0) >= p.usageLimit) return false;
    if (p.startHour != null || p.endHour != null) {
      const start = p.startHour ?? 0;
      const end = p.endHour ?? 24;
      if (currentHour < start || currentHour > end) return false;
    }
    if (vehicleCategoryId != null && p.categories?.length > 0) {
      const hasCategory = p.categories.some((c) => c.vehicleCategoryId === vehicleCategoryId);
      if (!hasCategory) return false;
    }
    return true;
  });
}

export async function countUsagesByPromotion(promotionId) {
  return prisma.promotionUsage.count({ where: { promotionId } });
}

export async function countUsagesByUserForPromotion(promotionId, userId) {
  return prisma.promotionUsage.count({
    where: { promotionId, userId },
  });
}

export async function recordUsage(promotionId, userId, bookingId = null) {
  return prisma.promotionUsage.create({
    data: { promotionId, userId, bookingId },
  });
}
