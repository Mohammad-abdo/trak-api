/**
 * Dual emit: legacy ride tracking events + Flutter TrackingSocketEvents names.
 */

import { emitToRide } from "./socketService.js";

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
