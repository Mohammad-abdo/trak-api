/**
 * Dedicated Private Booking - configurable settings.
 * Override via env: DEDICATED_BOOKING_TAX_RATE, CANCELLATION_FULL_REFUND_HOURS, etc.
 */
export const dedicatedBookingConfig = {
  /** Tax rate (e.g. 0.15 = 15%). Used for invoice. */
  taxRate: parseFloat(process.env.DEDICATED_BOOKING_TAX_RATE || '0'),
  /** Hours before start: cancel => full refund */
  cancellationFullRefundHours: parseInt(process.env.DEDICATED_CANCELLATION_FULL_REFUND_HOURS || '24', 10),
  /** Hours before start: between this and fullRefund => 50% charge */
  cancellationHalfChargeHours: parseInt(process.env.DEDICATED_CANCELLATION_HALF_CHARGE_HOURS || '2', 10),
  /** Less than this => no refund */
  minDurationHours: 1,
  maxDurationHours: 24,
  /** Coordinate bounds (optional validation) */
  latMin: -90,
  latMax: 90,
  lngMin: -180,
  lngMax: 180,
};
