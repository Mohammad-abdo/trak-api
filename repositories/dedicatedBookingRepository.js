import prisma from '../utils/prisma.js';
import { BookingStatus } from '@prisma/client';

/**
 * Repository layer: all Prisma access for Dedicated Booking feature.
 * Isolated from Ride logic.
 */

export async function create(data) {
  return prisma.dedicatedBooking.create({
    data: {
      userId: data.userId,
      driverId: data.driverId ?? undefined,
      vehicleCategoryId: data.vehicleCategoryId,
      pickupAddress: data.pickupAddress,
      pickupLat: data.pickupLat,
      pickupLng: data.pickupLng,
      dropoffAddress: data.dropoffAddress,
      dropoffLat: data.dropoffLat,
      dropoffLng: data.dropoffLng,
      bookingDate: data.bookingDate,
      startTime: data.startTime,
      durationHours: data.durationHours,
      baseFare: data.baseFare,
      pricePerHour: data.pricePerHour,
      totalPrice: data.totalPrice,
      status: data.status ?? 'PENDING',
      paymentStatus: data.paymentStatus ?? 'UNPAID',
      notes: data.notes,
      stripePaymentIntentId: data.stripePaymentIntentId,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, contactNumber: true } },
      driver: { select: { id: true, firstName: true, lastName: true, contactNumber: true } },
      vehicleCategory: { select: { id: true, name: true, nameAr: true } },
    },
  });
}

export async function findById(id) {
  return prisma.dedicatedBooking.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, contactNumber: true } },
      driver: { select: { id: true, firstName: true, lastName: true, contactNumber: true } },
      vehicleCategory: { select: { id: true, name: true, nameAr: true } },
      invoice: true,
      locationUpdates: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function findMany(filters = {}) {
  const { userId, driverId, status, fromDate, toDate, availableForDriver, page = 1, limit = 20 } = filters;
  const where = {};
  if (availableForDriver) {
    where.status = { in: ['PENDING', 'APPROVED'] };
    where.driverId = null;
    where.startTime = { gte: new Date() };
  } else {
    if (userId != null) where.userId = userId;
    if (driverId != null) where.driverId = driverId;
    if (status != null) where.status = status;
    if (fromDate != null || toDate != null) {
      where.startTime = where.startTime || {};
      if (fromDate != null) where.startTime.gte = new Date(fromDate);
      if (toDate != null) where.startTime.lte = new Date(toDate);
    }
  }

  const [items, total] = await prisma.$transaction([
    prisma.dedicatedBooking.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        vehicleCategory: { select: { id: true, name: true } },
      },
      orderBy: { startTime: availableForDriver ? 'asc' : 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dedicatedBooking.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function updateStatus(id, status, extra = {}) {
  return prisma.dedicatedBooking.update({
    where: { id },
    data: { status, ...extra },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
      vehicleCategory: { select: { id: true, name: true } },
    },
  });
}

export async function assignDriver(id, driverId) {
  return prisma.dedicatedBooking.update({
    where: { id },
    data: { driverId, status: BookingStatus.DRIVER_ASSIGNED },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
      vehicleCategory: { select: { id: true, name: true } },
    },
  });
}

export async function deleteById(id) {
  return prisma.dedicatedBooking.delete({ where: { id } });
}

/** Find overlapping bookings for a driver in [startTime, endTime). Uses startTime/duration or startedAt/duration. */
export async function findOverlappingDriverBookings(driverId, startTime, endTime, excludeBookingId = null) {
  const all = await prisma.dedicatedBooking.findMany({
    where: {
      driverId,
      status: { in: [BookingStatus.ACTIVE, BookingStatus.APPROVED, BookingStatus.DRIVER_ASSIGNED, BookingStatus.ON_THE_WAY] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
  });
  const start = new Date(startTime);
  const end = new Date(endTime);
  return all.filter((b) => {
    const bStart = b.startedAt ? new Date(b.startedAt) : new Date(b.startTime);
    const bEnd = new Date(bStart.getTime() + b.durationHours * 60 * 60 * 1000);
    return bStart < end && bEnd > start;
  });
}

/** Get driver's bookings in time window by startTime (for overlap check before startedAt set). */
export async function findDriverBookingsByStartWindow(driverId, startTime, endTime, excludeBookingId = null) {
  const where = {
    driverId,
    status: { in: [BookingStatus.PENDING, BookingStatus.APPROVED, BookingStatus.DRIVER_ASSIGNED, BookingStatus.ON_THE_WAY, BookingStatus.ACTIVE] },
    startTime: { gte: startTime, lt: endTime },
  };
  if (excludeBookingId) where.id = { not: excludeBookingId };
  return prisma.dedicatedBooking.findMany({ where });
}

export async function update(id, data) {
  return prisma.dedicatedBooking.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      driver: { select: { id: true, firstName: true, lastName: true } },
      vehicleCategory: { select: { id: true, name: true } },
    },
  });
}

// ---------- BookingLocationUpdate ----------
export async function createLocationUpdate(bookingId, lat, lng) {
  return prisma.bookingLocationUpdate.create({
    data: { bookingId, lat, lng },
  });
}

// ---------- BookingInvoice ----------
export async function createInvoice(data) {
  return prisma.bookingInvoice.create({
    data: {
      bookingId: data.bookingId,
      subtotal: data.subtotal,
      tax: data.tax,
      discount: data.discount,
      total: data.total,
      issuedAt: data.issuedAt,
      paidAt: data.paidAt,
    },
  });
}

export async function findInvoiceByBookingId(bookingId) {
  return prisma.bookingInvoice.findUnique({
    where: { bookingId },
  });
}

// ---------- User / VehicleCategory existence ----------
export async function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

export async function findDriverById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  return user && user.userType && user.userType.toLowerCase() === 'driver' ? user : null;
}

export async function findVehicleCategoryById(id) {
  return prisma.vehicleCategory.findFirst({
    where: { id, status: 1 },
  });
}
