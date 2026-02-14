import prisma from '../utils/prisma.js';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import * as repo from '../repositories/dedicatedBookingRepository.js';
import { dedicatedBookingConfig } from '../config/dedicatedBookingConfig.js';
import * as paymentService from './dedicatedBookingPaymentService.js';
import * as promotionService from './promotionService.js';

/**
 * totalPrice = baseFare + (pricePerHour * durationHours)
 */
export function calculateTotalPrice(baseFare, pricePerHour, durationHours) {
  return Math.round((baseFare + pricePerHour * durationHours) * 100) / 100;
}

/**
 * Cancellation policy: configurable.
 * Returns { refundPercent, chargeAmount }.
 */
export function getCancellationRefund(bookingStartTime, cancelledAt = new Date()) {
  const start = new Date(bookingStartTime);
  const now = new Date(cancelledAt);
  const hoursUntilStart = (start - now) / (60 * 60 * 1000);
  const { cancellationFullRefundHours, cancellationHalfChargeHours } = dedicatedBookingConfig;

  if (hoursUntilStart > cancellationFullRefundHours) {
    return { refundPercent: 100, chargeAmount: 0 };
  }
  if (hoursUntilStart > cancellationHalfChargeHours) {
    return { refundPercent: 50, chargeAmount: null };
  }
  return { refundPercent: 0, chargeAmount: null };
}

/**
 * Validate: date/time not in past, vehicle category exists, user exists.
 */
export async function validateCreateInput(data) {
  const bookingDate = new Date(data.bookingDate);
  const startTime = new Date(data.startTime);
  const now = new Date();
  if (bookingDate < new Date(now.toDateString())) {
    throw new Error('BOOKING_DATE_IN_PAST');
  }
  if (startTime < now) {
    throw new Error('START_TIME_IN_PAST');
  }
  const user = await repo.findUserById(data.userId);
  if (!user) throw new Error('USER_NOT_FOUND');
  const vehicleCategory = await repo.findVehicleCategoryById(data.vehicleCategoryId);
  if (!vehicleCategory) throw new Error('VEHICLE_CATEGORY_NOT_FOUND');
}

export async function create(data) {
  await validateCreateInput(data);
  let totalPrice = calculateTotalPrice(data.baseFare, data.pricePerHour, data.durationHours);
  const startTime = new Date(data.startTime);
  const bookingDate = new Date(data.bookingDate);
  if (bookingDate.toDateString() !== startTime.toDateString()) {
    throw new Error('BOOKING_DATE_MUST_MATCH_START_DATE');
  }

  const promotionResult = await promotionService.applyPromotion({
    userId: data.userId,
    bookingType: 'DEDICATED',
    vehicleCategoryId: data.vehicleCategoryId,
    totalPrice,
    bookingDate: startTime,
    code: data.promotionCode || null,
  });
  const finalPrice = promotionResult.applied ? promotionResult.finalPrice : totalPrice;

  const booking = await repo.create({
    userId: data.userId,
    vehicleCategoryId: data.vehicleCategoryId,
    pickupAddress: data.pickupAddress,
    pickupLat: data.pickupLat,
    pickupLng: data.pickupLng,
    dropoffAddress: data.dropoffAddress,
    dropoffLat: data.dropoffLat,
    dropoffLng: data.dropoffLng,
    bookingDate,
    startTime,
    durationHours: data.durationHours,
    baseFare: data.baseFare,
    pricePerHour: data.pricePerHour,
    totalPrice: finalPrice,
    notes: data.notes,
  });

  if (promotionResult.applied && promotionResult.promotion?.id) {
    await promotionService.recordPromotionUsage(promotionResult.promotion.id, data.userId, booking.id);
  }

  const paymentIntent = await paymentService.createPaymentIntent(finalPrice, booking.id);
  if (paymentIntent.paymentIntentId) {
    await repo.update(booking.id, {
      stripePaymentIntentId: paymentIntent.paymentIntentId,
      paymentStatus: PaymentStatus.PREAUTHORIZED,
    });
  }

  const full = await repo.findById(booking.id);
  return {
    ...full,
    clientSecret: paymentIntent.clientSecret || undefined,
    promotionDiscount: promotionResult.applied ? promotionResult.discount : undefined,
  };
}

export async function list(filters) {
  return repo.findMany(filters);
}

/** List bookings available for drivers to accept (PENDING/APPROVED, no driver, startTime in future). */
export async function listAvailableForDrivers(opts = {}) {
  return repo.findMany({
    availableForDriver: true,
    page: 1,
    limit: Math.min(50, opts.limit || 50),
  });
}

export async function getById(id) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  return booking;
}

export async function updateStatus(id, status) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  const allowed = [
    BookingStatus.PENDING,
    BookingStatus.APPROVED,
    BookingStatus.DRIVER_ASSIGNED,
    BookingStatus.ON_THE_WAY,
    BookingStatus.ACTIVE,
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED,
  ];
  if (!allowed.includes(status)) throw new Error('INVALID_STATUS');
  return repo.updateStatus(id, status);
}

export async function remove(id) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (booking.status === BookingStatus.ACTIVE) {
    throw new Error('CANNOT_DELETE_ACTIVE_BOOKING');
  }
  if (booking.stripePaymentIntentId) {
    await paymentService.cancelPaymentIntent(booking.stripePaymentIntentId);
  }
  await repo.deleteById(id);
  return { deleted: true };
}

export async function assignDriver(id, driverId) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.APPROVED) {
    throw new Error('BOOKING_NOT_IN_ASSIGNABLE_STATE');
  }

  const driver = await repo.findDriverById(driverId);
  if (!driver) throw new Error('DRIVER_NOT_FOUND');

  const start = new Date(booking.startTime);
  const end = new Date(start.getTime() + booking.durationHours * 60 * 60 * 1000);
  const overlapping = await repo.findOverlappingDriverBookings(driverId, start, end, id);
  if (overlapping.length > 0) {
    throw new Error('DRIVER_HAS_OVERLAPPING_BOOKING');
  }

  return repo.assignDriver(id, driverId);
}

/** Driver accepts a dedicated booking (same as assignDriver with current driver). */
export async function acceptByDriver(bookingId, driverId) {
  return assignDriver(bookingId, driverId);
}

export async function start(id) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (booking.status !== BookingStatus.DRIVER_ASSIGNED && booking.status !== BookingStatus.ON_THE_WAY) {
    throw new Error('BOOKING_CANNOT_BE_STARTED');
  }
  const startedAt = new Date();
  return repo.update(id, {
    status: BookingStatus.ACTIVE,
    startedAt,
  });
}

export async function end(id) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (booking.status !== BookingStatus.ACTIVE) {
    throw new Error('BOOKING_IS_NOT_ACTIVE');
  }
  const endedAt = new Date();
  await repo.update(id, {
    status: BookingStatus.COMPLETED,
    endedAt,
    paymentStatus: PaymentStatus.CAPTURED,
  });
  if (booking.stripePaymentIntentId) {
    await paymentService.capturePaymentIntent(booking.stripePaymentIntentId);
  }
  await generateInvoice(id);
  return repo.findById(id);
}

export async function cancel(id) {
  const booking = await repo.findById(id);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if ([BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) {
    throw new Error('BOOKING_ALREADY_FINISHED_OR_CANCELLED');
  }
  const cancelledAt = new Date();
  const refund = getCancellationRefund(booking.startTime, cancelledAt);
  if (booking.stripePaymentIntentId) {
    await paymentService.cancelPaymentIntent(booking.stripePaymentIntentId);
  }
  await repo.update(id, {
    status: BookingStatus.CANCELLED,
    cancelledAt,
    paymentStatus: PaymentStatus.REFUNDED,
  });
  return repo.findById(id);
}

/**
 * Generate BookingInvoice when booking is COMPLETED.
 */
export async function generateInvoice(bookingId) {
  const existing = await repo.findInvoiceByBookingId(bookingId);
  if (existing) return existing;

  const booking = await repo.findById(bookingId);
  if (!booking || booking.status !== BookingStatus.COMPLETED) {
    throw new Error('BOOKING_NOT_COMPLETED');
  }

  const subtotal = booking.totalPrice;
  const taxRate = dedicatedBookingConfig.taxRate;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const discount = 0;
  const total = Math.round((subtotal + tax - discount) * 100) / 100;
  const issuedAt = new Date();
  const paidAt = booking.paymentStatus === PaymentStatus.CAPTURED ? issuedAt : null;

  const invoice = await repo.createInvoice({
    bookingId,
    subtotal,
    tax,
    discount,
    total,
    issuedAt,
    paidAt,
  });
  return invoice;
}

export async function getInvoice(bookingId) {
  const invoice = await repo.findInvoiceByBookingId(bookingId);
  if (!invoice) throw new Error('INVOICE_NOT_FOUND');
  return invoice;
}

/**
 * Record location update (from driver via Socket) and persist.
 */
export async function recordLocationUpdate(bookingId, lat, lng) {
  const booking = await repo.findById(bookingId);
  if (!booking) throw new Error('BOOKING_NOT_FOUND');
  if (booking.status !== BookingStatus.ACTIVE && booking.status !== BookingStatus.ON_THE_WAY) {
    throw new Error('BOOKING_NOT_ACTIVE_FOR_TRACKING');
  }
  return repo.createLocationUpdate(bookingId, lat, lng);
}

/**
 * Auto-complete: called by scheduler when startedAt + durationHours has passed.
 */
export async function autoCompleteIfNeeded(bookingId) {
  const booking = await repo.findById(bookingId);
  if (!booking || booking.status !== BookingStatus.ACTIVE || !booking.startedAt) return null;
  const endTime = new Date(booking.startedAt.getTime() + booking.durationHours * 60 * 60 * 1000);
  if (new Date() < endTime) return null;
  return end(bookingId);
}
