import { z } from 'zod';

const optionalInt = z
  .union([z.literal(''), z.null(), z.undefined(), z.coerce.number().int().min(0)])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)));
const optionalIntHour = z
  .union([z.literal(''), z.null(), z.undefined(), z.coerce.number().int().min(0).max(24)])
  .transform((v) => (v === '' || v === null || v === undefined ? null : Number(v)));

export const createPromotionSchema = z.object({
  body: z
    .object({
      code: z.string().min(1).max(50).transform((s) => (s && typeof s === 'string' ? s.trim().toUpperCase() : s)),
      discountType: z.enum(['PERCENTAGE', 'FIXED']),
      discountValue: z.coerce.number().min(0),
      startDate: z.string().min(1, 'Start date is required'),
      endDate: z.string().min(1, 'End date is required'),
      usageLimit: optionalInt.optional(),
      usagePerUser: optionalInt.optional(),
      bookingType: z.enum(['RIDE', 'DEDICATED', 'ALL']).optional().default('ALL'),
      startHour: optionalIntHour.optional(),
      endHour: optionalIntHour.optional(),
      isActive: z.boolean().optional().default(true),
      categoryIds: z.array(z.coerce.number().int().positive()).optional().default([]),
    })
    .refine((b) => !b.startDate || !b.endDate || new Date(b.endDate) >= new Date(b.startDate), {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }),
});

export const updatePromotionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    code: z.string().min(1).max(50).transform((s) => s?.trim().toUpperCase()).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.coerce.number().min(0).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    usageLimit: optionalInt.optional(),
    usagePerUser: optionalInt.optional(),
    bookingType: z.enum(['RIDE', 'DEDICATED', 'ALL']).optional(),
    startHour: optionalIntHour.optional(),
    endHour: optionalIntHour.optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.coerce.number().int().positive()).optional(),
  }).refine((b) => !b.startDate || !b.endDate || new Date(b.endDate) >= new Date(b.startDate), {
    message: 'endDate must be >= startDate',
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const validatePromotionSchema = z.object({
  body: z.object({
    code: z.string().min(1),
    bookingType: z.enum(['RIDE', 'DEDICATED']),
    categoryId: z.number().int().positive().nullable().optional(),
    estimatedPrice: z.number().min(0),
  }),
});

export function validate(schema, data) {
  return schema.parse(data);
}
