import { emitTripCancelled } from "./rideTrackingBroadcast.js";
import { emitDriverTripSyncForRideId } from "./driverTripSocketSync.js";

/**
 * Central cancellation socket notify (rider or driver cancelled).
 */
export function notifyRideCancelled(io, rideId, opts = {}) {
    if (!io || !rideId) return;

    const {
        driverId = null,
        riderId = null,
        cancelledBy = "rider",
        reason = null,
        syncReason = "trip_cancelled",
    } = opts;

    const payload = {
        cancelled_by: cancelledBy,
        cancelBy: cancelledBy,
        reason: reason ?? undefined,
        status: "cancelled",
    };

    emitTripCancelled(io, rideId, payload, { driverId, riderId });

    const syncTarget = driverId ?? undefined;
    if (syncTarget) {
        emitDriverTripSyncForRideId(io, rideId, syncReason, syncTarget);
    } else {
        emitDriverTripSyncForRideId(io, rideId, syncReason);
    }
}
