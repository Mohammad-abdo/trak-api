import prisma from "./prisma.js";
import { emitToDriver, emitToRide } from "./socketService.js";

/**
 * Same fields the driver sees from GET /apimobile/driver/negotiation/status/:id,
 * plus ids for routing. Used as WebSocket payload so apps can skip polling.
 */
export async function getDriverTripSyncPayload(rideId) {
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return null;

    const ride = await prisma.rideRequest.findUnique({
        where: { id },
        select: {
            id: true,
            driverId: true,
            riderId: true,
            status: true,
            totalAmount: true,
            negotiatedFare: true,
            negotiationStatus: true,
            negotiationExpiresAt: true,
            lastNegotiationBy: true,
        },
    });
    if (!ride) return null;

    let negotiationStatus = ride.negotiationStatus;
    let driverId = ride.driverId;

    if (negotiationStatus === "pending" && ride.negotiationExpiresAt && new Date() > new Date(ride.negotiationExpiresAt)) {
        negotiationStatus = "expired";
        driverId = null;
        await prisma.rideRequest.update({
            where: { id: ride.id },
            data: { negotiationStatus: "expired", driverId: null },
        });
    }

    return {
        rideRequestId: ride.id,
        driverId,
        riderId: ride.riderId,
        rideStatus: ride.status,
        negotiationStatus,
        originalFare: ride.totalAmount != null ? parseFloat(ride.totalAmount) : null,
        negotiatedFare: ride.negotiatedFare != null ? parseFloat(ride.negotiatedFare) : null,
        expiresAt: ride.negotiationExpiresAt,
        lastNegotiationBy: ride.lastNegotiationBy,
    };
}

/**
 * @param {import("socket.io").Server | null} io
 * @param {object} payload from getDriverTripSyncPayload (must include rideRequestId)
 * @param {string} syncReason machine tag for client logging
 * @param {number|null|undefined} notifyDriverIdOverride when ride has no driverId yet but one driver must be notified (e.g. reject listing)
 */
export function emitDriverTripSync(io, payload, syncReason, notifyDriverIdOverride = null) {
    if (!io || !payload?.rideRequestId) return;
    const body = {
        ...payload,
        syncReason,
        syncedAt: new Date().toISOString(),
    };
    const driverTarget = notifyDriverIdOverride ?? payload.driverId;
    if (driverTarget) emitToDriver(io, driverTarget, "driver-trip-sync", body);
    emitToRide(io, payload.rideRequestId, "trip-sync", body);
}

export async function emitDriverTripSyncForRideId(io, rideId, syncReason, notifyDriverIdOverride = null) {
    if (!io) return;
    const payload = await getDriverTripSyncPayload(rideId);
    if (!payload) return;
    emitDriverTripSync(io, payload, syncReason, notifyDriverIdOverride);
}

export function emitDriverTripSyncFromReq(req, rideId, syncReason, notifyDriverIdOverride = null) {
    const io = req.app?.get?.("io") || global.io;
    return emitDriverTripSyncForRideId(io, rideId, syncReason, notifyDriverIdOverride);
}
