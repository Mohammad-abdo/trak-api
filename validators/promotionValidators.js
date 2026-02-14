import { z } from 'zod';

export const createPromotionSchema = z.object({
  body: z.object({
    code: z.string().min(1).max(50),
    discountType: z.enum(['PERCENTAGE', 'FIXED']),
    discountValue: z.number().min(0),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    usageLimit: z.number().int().min(0).nullable().optional(),
    usagePerUser: z.number().int().min(0).nullable().optional(),
    bookingType: z.enum(['RIDE', 'DEDICATED', 'ALL']).optional().default('ALL'),
    startHour: z.number().int().min(0).max(23).nullable().optional(),
    endHour: z.number().int().min(0).max(24).nullable().optional(),
    isActive: z.boolean().optional().default(true),
    categoryIds: z.array(z.number().int().positive()).optional().default([]),
  }),
});

export const updatePromotionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    code: z.string().min(1).max(50).optional(),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).optional(),
    discountValue: z.number().min(0).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    usageLimit: z.number().int().min(0).nullable().optional(),
    usagePerUser: z.number().int().min(0).nullable().optional(),
    bookingType: z.enum(['RIDE', 'DEDICATED', 'ALL']).optional(),
    startHour: z.number().int().min(0).max(23).nullable().optional(),
    endHour: z.number().int().min(0).max(24).nullable().optional(),
    isActive: z.boolean().optional(),
    categoryIds: z.array(z.number().int().positive()).optional(),
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
