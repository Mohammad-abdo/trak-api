import { z } from 'zod';
import { dedicatedBookingConfig } from '../config/dedicatedBookingConfig.js';

const coordinateSchema = z.number().min(dedicatedBookingConfig.latMin).max(dedicatedBookingConfig.latMax);
const lngSchema = z.number().min(dedicatedBookingConfig.lngMin).max(dedicatedBookingConfig.lngMax);

export const createDedicatedBookingSchema = z.object({
  body: z.object({
    userId: z.number().int().positive(),
    vehicleCategoryId: z.number().int().positive(),
    pickupAddress: z.string().min(1).max(500),
    pickupLat: coordinateSchema,
    pickupLng: lngSchema,
    dropoffAddress: z.string().min(1).max(500),
    dropoffLat: coordinateSchema,
    dropoffLng: lngSchema,
    bookingDate: z.string().min(1),
    startTime: z.string().min(1),
    durationHours: z.number().int().min(dedicatedBookingConfig.minDurationHours).max(dedicatedBookingConfig.maxDurationHours),
    baseFare: z.number().min(0),
    pricePerHour: z.number().min(0),
    notes: z.string().max(2000).optional(),
    promotionCode: z.string().max(50).optional(),
  }),
});

export const assignDriverSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ driverId: z.number().int().positive() }),
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']),
  }),
});

export const idParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const locationUpdateSchema = z.object({
  bookingId: z.string().uuid(),
  lat: coordinateSchema,
  lng: lngSchema,
});

export const listQuerySchema = z.object({
  query: z.object({
    userId: z.coerce.number().int().positive().optional(),
    driverId: z.coerce.number().int().positive().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'DRIVER_ASSIGNED', 'ON_THE_WAY', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

/**
 * Validate and parse. Throws ZodError on failure.
 */
export function validate(schema, data) {
  return schema.parse(data);
}

/**
 * Safe parse - returns { success, data, error }.
 */
export function safeParse(schema, data) {
  return schema.safeParse(data);
}
