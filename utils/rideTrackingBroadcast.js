/**
 * Dual emit: legacy ride tracking events + Flutter TrackingSocketEvents names.
 */

import { emitToDriver, emitToRide, emitToUser } from "./socketService.js";

const FLUTTER_STATUS_EVENT = {
    arrived: "driverArrived",
    started: "tripStarted",
};

export function emitDriverLocationForRide(io, rideId, payload) {
    if (!io || !payload) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, "driver-location-for-ride", payload);
    emitToRide(io, id, "driverLocationUpdated", payload);
}

export function emitRideStatusChange(io, rideId, status, payload) {
    if (!io || !payload) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, `ride-${status}`, payload);
    const flutterName = FLUTTER_STATUS_EVENT[status];
    if (flutterName) emitToRide(io, id, flutterName, payload);
}

export function emitTripCompleted(io, rideId, payload) {
    if (!io || !payload) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, "trip-completed", payload);
    emitToRide(io, id, "tripEnded", payload);
}

/**
 * Rider or driver cancelled the trip — notify ride room + assigned parties.
 * @param {{ driverId?: number|null, riderId?: number|null }} targets
 */
export function emitTripCancelled(io, rideId, payload, targets = {}) {
    if (!io) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;

    const body = {
        ...payload,
        rideRequestId: id,
        tripId: id,
        booking_id: id,
    };

    emitToRide(io, id, "trip-cancelled", body);
    emitToRide(io, id, "tripCancelled", body);

    const driverId = targets.driverId != null ? Number(targets.driverId) : null;
    const riderId = targets.riderId != null ? Number(targets.riderId) : null;

    if (driverId && !Number.isNaN(driverId)) {
        emitToDriver(io, driverId, "trip-cancelled", body);
        emitToDriver(io, driverId, "tripCancelled", body);
    }
    if (riderId && !Number.isNaN(riderId)) {
        emitToUser(io, riderId, "trip-cancelled", body);
        emitToUser(io, riderId, "tripCancelled", body);
    }
}
