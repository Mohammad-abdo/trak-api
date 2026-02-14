import prisma from './prisma.js';
import * as dedicatedBookingService from '../services/dedicatedBookingService.js';
import { BookingStatus } from '@prisma/client';

/**
 * Find ACTIVE dedicated bookings where startedAt + durationHours has passed
 * and auto-complete them (set COMPLETED, endedAt, capture payment, generate invoice).
 * Run this on a cron (e.g. every minute).
 */
export async function runAutoComplete() {
  const now = new Date();
  const active = await prisma.dedicatedBooking.findMany({
    where: {
      status: BookingStatus.ACTIVE,
      startedAt: { not: null },
    },
  });

  for (const b of active) {
    if (!b.startedAt) continue;
    const endTime = new Date(b.startedAt.getTime() + b.durationHours * 60 * 60 * 1000);
    if (now >= endTime) {
      try {
        await dedicatedBookingService.autoCompleteIfNeeded(b.id);
      } catch (err) {
        console.error(`Dedicated booking auto-complete failed for ${b.id}:`, err.message);
      }
    }
  }
}
