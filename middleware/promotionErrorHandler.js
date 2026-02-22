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
    const issues = err.issues ?? [];
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: issues.map((e) => ({ path: (e.path || []).join('.'), message: e.message })),
    });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ success: false, message: 'PROMOTION_CODE_EXISTS' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, message: 'PROMOTION_NOT_FOUND' });
  }
  if (err.code && String(err.code).startsWith('P')) {
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'development' ? err.message : 'Database error. Ensure promotions migration has been run.',
    });
  }
  if (err.message === 'INVALID_IMAGE_TYPE') {
    return res.status(400).json({ success: false, message: 'Invalid image type. Use JPEG, PNG, GIF or WebP.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'Image too large. Max 5MB.' });
  }
  const code = err.message;
  const status = CODE_TO_HTTP[code] ?? 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? (process.env.NODE_ENV === 'development' ? err.message : 'Request failed') : code,
  });
}
