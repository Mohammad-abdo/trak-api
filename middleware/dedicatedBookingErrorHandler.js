import { ZodError } from 'zod';

const CODE_TO_HTTP = {
  BOOKING_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  DRIVER_NOT_FOUND: 404,
  VEHICLE_CATEGORY_NOT_FOUND: 404,
  BOOKING_DATE_IN_PAST: 400,
  START_TIME_IN_PAST: 400,
  BOOKING_DATE_MUST_MATCH_START_DATE: 400,
  INVALID_STATUS: 400,
  BOOKING_NOT_IN_ASSIGNABLE_STATE: 400,
  DRIVER_HAS_OVERLAPPING_BOOKING: 409,
  BOOKING_CANNOT_BE_STARTED: 400,
  BOOKING_IS_NOT_ACTIVE: 400,
  BOOKING_ALREADY_FINISHED_OR_CANCELLED: 400,
  CANNOT_DELETE_ACTIVE_BOOKING: 400,
  BOOKING_NOT_ACTIVE_FOR_TRACKING: 400,
  BOOKING_NOT_COMPLETED: 400,
  INVOICE_NOT_FOUND: 404,
};

/**
 * Express error handler for dedicated booking routes.
 * Handles ZodError and business errors (message as code).
 */
export function dedicatedBookingErrorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const code = err.message;
  const status = CODE_TO_HTTP[code] ?? 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? (process.env.NODE_ENV === 'development' ? err.message : 'Request failed') : (code || err.message),
  });
}
