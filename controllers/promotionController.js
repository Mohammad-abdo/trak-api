import * as service from '../services/promotionService.js';
import { sendPromotionNotification } from '../services/promotionNotificationService.js';
import { validate, idParamSchema, createPromotionSchema, updatePromotionSchema, validatePromotionSchema } from '../validators/promotionValidators.js';

/**
 * POST /api/admin/promotions
 */
export async function create(req, res, next) {
  try {
    const { body } = validate(createPromotionSchema, { body: req.body });
    const payload = {
      code: body.code,
      discountType: body.discountType,
      discountValue: body.discountValue,
      startDate: body.startDate,
      endDate: body.endDate,
      usageLimit: body.usageLimit ?? null,
      usagePerUser: body.usagePerUser ?? null,
      bookingType: body.bookingType || 'ALL',
      startHour: body.startHour ?? null,
      endHour: body.endHour ?? null,
      isActive: body.isActive !== false,
      categoryIds: Array.isArray(body.categoryIds) ? body.categoryIds.map(Number) : [],
    };
    const promotion = await service.createPromotion(payload);
    sendPromotionNotification(promotion);
    res.status(201).json({ success: true, data: promotion });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/promotions
 */
export async function list(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const result = await service.listPromotions({ page, limit });
    res.json({
      success: true,
      data: result.items,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/promotions/:id
 */
export async function getById(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const promotion = await service.getPromotionById(params.id);
    res.json({ success: true, data: promotion });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/promotions/:id
 */
export async function update(req, res, next) {
  try {
    const { params, body } = validate(updatePromotionSchema, { params: req.params, body: req.body });
    const promotion = await service.updatePromotion(params.id, body);
    res.json({ success: true, data: promotion });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/promotions/:id
 */
export async function remove(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    await service.deletePromotion(params.id);
    res.json({ success: true, message: 'Promotion deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/promotions/:id/toggle
 */
export async function toggle(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const promotion = await service.togglePromotion(params.id);
    res.json({ success: true, data: promotion });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/promotions/validate (public – user can validate code before booking)
 */
export async function validatePromotion(req, res, next) {
  try {
    const { body } = validate(validatePromotionSchema, { body: req.body });
    const result = await service.validatePromotion({
      code: body.code,
      bookingType: body.bookingType,
      categoryId: body.categoryId ?? null,
      estimatedPrice: body.estimatedPrice,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
