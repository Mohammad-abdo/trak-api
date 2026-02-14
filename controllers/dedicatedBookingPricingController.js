import prisma from '../utils/prisma.js';

const PRICING_ID = 1;

/**
 * GET /api/dedicated-bookings/pricing
 */
export async function getPricing(req, res, next) {
  try {
    const row = await prisma.dedicatedBookingPricing.findUnique({
      where: { id: PRICING_ID },
    });
    const data = row
      ? { pricePerKm: row.pricePerKm, pricePerDay: row.pricePerDay, pricePerTrip: row.pricePerTrip, baseFare: row.baseFare, pricePerHour: row.pricePerHour, updatedAt: row.updatedAt }
      : { pricePerKm: 0, pricePerDay: 0, pricePerTrip: 0, baseFare: 0, pricePerHour: 0, updatedAt: new Date() };
    res.json({
      success: true,
      data: data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/dedicated-bookings/pricing
 * Body: { pricePerKm?, pricePerDay?, pricePerTrip?, baseFare?, pricePerHour? }
 */
export async function updatePricing(req, res, next) {
  try {
    const body = req.body || {};
    const data = {};
    if (body.pricePerKm !== undefined) data.pricePerKm = Math.max(0, Number(body.pricePerKm) || 0);
    if (body.pricePerDay !== undefined) data.pricePerDay = Math.max(0, Number(body.pricePerDay) || 0);
    if (body.pricePerTrip !== undefined) data.pricePerTrip = Math.max(0, Number(body.pricePerTrip) || 0);
    if (body.baseFare !== undefined) data.baseFare = Math.max(0, Number(body.baseFare) || 0);
    if (body.pricePerHour !== undefined) data.pricePerHour = Math.max(0, Number(body.pricePerHour) || 0);

    let row = await prisma.dedicatedBookingPricing.findUnique({ where: { id: PRICING_ID } });
    if (row) {
      if (Object.keys(data).length) row = await prisma.dedicatedBookingPricing.update({ where: { id: PRICING_ID }, data });
    } else {
      row = await prisma.dedicatedBookingPricing.create({
        data: { pricePerKm: 0, pricePerDay: 0, pricePerTrip: 0, baseFare: 0, pricePerHour: 0, ...data },
      });
    }
    res.json({
      success: true,
      data: {
        pricePerKm: row.pricePerKm,
        pricePerDay: row.pricePerDay,
        pricePerTrip: row.pricePerTrip,
        baseFare: row.baseFare,
        pricePerHour: row.pricePerHour,
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}
