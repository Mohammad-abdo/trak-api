import { ZodError } from 'zod';

const CODE_TO_HTTP = {
  CODE_REQUIRED: 400,
  PROMOTION_CODE_EXISTS: 409,
  PERCENTAGE_DISCOUNT_INVALID: 400,
  FIXED_DISCOUNT_INVALID: 400,
  END_DATE_BEFORE_START_DATE: 400,
  PROMOTION_NOT_FOUND: 404,
};

export function promotionErrorHandler(err, req, res, next) {
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
    message: status === 500 ? (process.env.NODE_ENV === 'development' ? err.message : 'Request failed') : code,
  });
}
