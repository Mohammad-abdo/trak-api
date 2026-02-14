import * as service from '../services/dedicatedBookingService.js';
import {
  createDedicatedBookingSchema,
  assignDriverSchema,
  updateStatusSchema,
  idParamSchema,
  listQuerySchema,
  validate,
  safeParse,
} from '../validators/dedicatedBookingValidators.js';

/**
 * POST /api/dedicated-bookings
 */
export async function create(req, res, next) {
  try {
    const { body } = validate(createDedicatedBookingSchema, { body: req.body });
    const bookingDate = new Date(body.bookingDate);
    const startTime = new Date(body.startTime);
    const payload = {
      userId: body.userId,
      vehicleCategoryId: body.vehicleCategoryId,
      pickupAddress: body.pickupAddress,
      pickupLat: body.pickupLat,
      pickupLng: body.pickupLng,
      dropoffAddress: body.dropoffAddress,
      dropoffLat: body.dropoffLat,
      dropoffLng: body.dropoffLng,
      bookingDate,
      startTime,
      durationHours: body.durationHours,
      baseFare: body.baseFare,
      pricePerHour: body.pricePerHour,
      notes: body.notes,
      promotionCode: body.promotionCode || null,
    };
    const result = await service.create(payload);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dedicated-bookings
 */
export async function list(req, res, next) {
  try {
    const q = req.query || {};
    const status = q.status && q.status !== 'all' ? q.status : undefined;
    const filters = {
      userId: q.userId ? parseInt(q.userId, 10) : undefined,
      driverId: q.driverId ? parseInt(q.driverId, 10) : undefined,
      status: status,
      fromDate: q.fromDate || undefined,
      toDate: q.toDate || undefined,
      page: Math.max(1, parseInt(q.page, 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(q.limit, 10) || 20)),
    };
    if (Number.isNaN(filters.userId)) filters.userId = undefined;
    if (Number.isNaN(filters.driverId)) filters.driverId = undefined;
    const result = await service.list(filters);
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
 * GET /api/dedicated-bookings/available (drivers only – list bookings they can accept)
 */
export async function listAvailable(req, res, next) {
  try {
    const result = await service.listAvailableForDrivers();
    res.json({
      success: true,
      data: result.items,
      meta: { total: result.total },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dedicated-bookings/:id/accept (driver accepts the booking)
 */
export async function acceptByDriver(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const driverId = req.user?.id;
    if (!driverId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const booking = await service.acceptByDriver(params.id, driverId);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dedicated-bookings/:id
 */
export async function getById(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const booking = await service.getById(params.id);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/dedicated-bookings/:id/status
 */
export async function updateStatus(req, res, next) {
  try {
    const { params, body } = validate(updateStatusSchema, { params: req.params, body: req.body });
    const booking = await service.updateStatus(params.id, body.status);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/dedicated-bookings/:id
 */
export async function remove(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    await service.remove(params.id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dedicated-bookings/:id/assign-driver
 */
export async function assignDriver(req, res, next) {
  try {
    const { params, body } = validate(assignDriverSchema, { params: req.params, body: req.body });
    const booking = await service.assignDriver(params.id, body.driverId);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dedicated-bookings/:id/start
 */
export async function start(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const booking = await service.start(params.id);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dedicated-bookings/:id/end
 */
export async function end(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const booking = await service.end(params.id);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/dedicated-bookings/:id/cancel
 */
export async function cancel(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const booking = await service.cancel(params.id);
    res.json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dedicated-bookings/:id/invoice
 */
export async function getInvoice(req, res, next) {
  try {
    const { params } = validate(idParamSchema, { params: req.params });
    const invoice = await service.getInvoice(params.id);
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}
