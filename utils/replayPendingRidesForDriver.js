import prisma from "./prisma.js";
import { calculateDistance } from "./pricingCalculator.js";
import { getDriverSearchRadius, getDriverRejectionSettings } from "./settingsHelper.js";
import { emitToDriver } from "./socketService.js";

function buildNewRideAvailablePayload(ride) {
    let storedPricing = ride.pricingData;
    if (typeof storedPricing === "string") {
        try {
            storedPricing = JSON.parse(storedPricing);
        } catch {
            storedPricing = null;
        }
    }
    const userRequestedPrice = storedPricing?.userRequestedPrice ?? parseFloat(ride.totalAmount);
    const distKm = storedPricing?.distanceKm;
    return {
        booking_id: ride.id,
        vehicleCategoryId: ride.vehicleCategoryId,
        totalAmount: parseFloat(ride.totalAmount),
        userRequestedPrice,
        pickup: {
            lat: parseFloat(ride.startLatitude),
            lng: parseFloat(ride.startLongitude),
            address: ride.startAddress || "",
        },
        dropoff: {
            lat: parseFloat(ride.endLatitude),
            lng: parseFloat(ride.endLongitude),
            address: ride.endAddress || "",
        },
        paymentType: ride.paymentType,
        isScheduled: Boolean(ride.isSchedule),
        distanceKm: distKm != null ? parseFloat(String(distKm)) : null,
        replay: true,
    };
}

/**
 * Re-sends `new-ride-available` for pending rides in radius so drivers who
 * missed the initial booking broadcast (socket off, or came online later)
 * still get real-time updates without manual reload.
 */
export async function replayPendingRidesForDriver(io, driverId, driverLat, driverLng) {
    if (!io || !driverId || !Number.isFinite(driverLat) || !Number.isFinite(driverLng)) return;

    const { enabled, maxCount, cooldownHours } = await getDriverRejectionSettings();
    if (enabled && maxCount > 0) {
        const driverRow = await prisma.user.findUnique({
            where: { id: driverId },
            select: { driverRejectionCount: true, lastRejectionAt: true },
        });
        const rejectionCount = driverRow?.driverRejectionCount ?? 0;
        if (rejectionCount >= maxCount && driverRow?.lastRejectionAt) {
            const cooldownMs = cooldownHours * 60 * 60 * 1000;
            if (Date.now() - new Date(driverRow.lastRejectionAt).getTime() < cooldownMs) {
                return;
            }
        }
    }

    const searchRadius = await getDriverSearchRadius();
    const now = new Date();
    const scheduleOpenAt = new Date(now.getTime() + 30 * 60 * 1000);

    const pendingRides = await prisma.rideRequest.findMany({
        where: {
            driverId: null,
            startLatitude: { not: null },
            startLongitude: { not: null },
            payments: { none: {} },
            OR: [
                { status: "pending", isSchedule: false },
                { status: "pending", isSchedule: true, scheduleDatetime: { lte: scheduleOpenAt } },
                { status: "scheduled", isSchedule: true, scheduleDatetime: { lte: scheduleOpenAt } },
            ],
        },
        select: {
            id: true,
            vehicleCategoryId: true,
            totalAmount: true,
            pricingData: true,
            paymentType: true,
            isSchedule: true,
            startLatitude: true,
            startLongitude: true,
            startAddress: true,
            endLatitude: true,
            endLongitude: true,
            endAddress: true,
            cancelledDriverIds: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
    });

    let sent = 0;
    for (const ride of pendingRides) {
        if (sent >= 20) break;
        const pickupLat = parseFloat(ride.startLatitude);
        const pickupLng = parseFloat(ride.startLongitude);
        if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) continue;

        const dist = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);
        if (dist > searchRadius) continue;

        let cancelledIds = [];
        if (ride.cancelledDriverIds) {
            try {
                cancelledIds = JSON.parse(ride.cancelledDriverIds);
            } catch {
                cancelledIds = [];
            }
        }
        if (Array.isArray(cancelledIds) && cancelledIds.includes(driverId)) continue;

        emitToDriver(io, driverId, "new-ride-available", buildNewRideAvailablePayload(ride));
        sent += 1;
    }
}
