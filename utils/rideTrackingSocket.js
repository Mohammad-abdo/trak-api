/**
 * Socket.IO handlers for trip tracking (Flutter TrackingSocketEvents + legacy).
 *
 * Room: `ride-{rideId}` — join via `subscribe-ride`, `joinChat`, or `joinTracking`.
 *
 * Driver -> server (Flutter):
 *   - updateDriverLocation  { tripId?, lat, lng, latitude?, longitude?, currentHeading? }
 *   - arrivedToPickup       { tripId / rideRequestId }
 *   - startTrip             { tripId / rideRequestId }
 *   - endTrip               { tripId / rideRequestId, tips? }
 *
 * Server -> room (dual emit):
 *   - driver-location-for-ride | driverLocationUpdated
 *   - ride-arrived | driverArrived
 *   - ride-started | tripStarted
 *   - trip-completed | tripEnded
 *
 * Errors to sender: tracking:error { code, message }
 *
 * REST fallback: POST .../location/update, .../rides/update-status, .../rides/complete
 */

import {
    updateDriverLocation,
    updateRideStatusForDriver,
    completeRideForDriver,
} from "../services/rideTrackingService.js";
import { parseLocationFromPayload, parseTripIdFromPayload } from "./rideTrackingPayload.js";

function currentDriver(socket) {
    const user = socket.data?.user;
    if (!user?.id) return null;
    if (String(user.userType || "").toLowerCase() !== "driver") return null;
    return user;
}

function emitTrackingError(socket, result) {
    socket.emit("tracking:error", {
        code: result.code || "ERROR",
        message: result.message || "Request failed",
    });
}

export function registerRideTrackingHandlers(socket, io) {
    socket.on("updateDriverLocation", async (payload) => {
        try {
            const user = currentDriver(socket);
            if (!user) {
                socket.emit("tracking:error", { code: "UNAUTHENTICATED", message: "Driver authentication required" });
                return;
            }
            const loc = parseLocationFromPayload(payload || {});
            if (!loc) {
                socket.emit("tracking:error", { code: "INVALID_LOCATION", message: "lat/lng or latitude/longitude required" });
                return;
            }
            const result = await updateDriverLocation(user.id, loc, io);
            if (!result.ok) emitTrackingError(socket, result);
        } catch (err) {
            console.error("updateDriverLocation error:", err);
            socket.emit("tracking:error", { code: "INTERNAL", message: "Failed to update location" });
        }
    });

    socket.on("arrivedToPickup", async (payload) => {
        try {
            const user = currentDriver(socket);
            if (!user) {
                socket.emit("tracking:error", { code: "UNAUTHENTICATED", message: "Driver authentication required" });
                return;
            }
            const rideId = parseTripIdFromPayload(payload);
            if (!rideId) {
                socket.emit("tracking:error", { code: "INVALID_RIDE_ID", message: "tripId / rideRequestId required" });
                return;
            }
            const result = await updateRideStatusForDriver(user.id, rideId, "arrived", io);
            if (!result.ok) emitTrackingError(socket, result);
        } catch (err) {
            console.error("arrivedToPickup error:", err);
            socket.emit("tracking:error", { code: "INTERNAL", message: "Failed to update status" });
        }
    });

    socket.on("startTrip", async (payload) => {
        try {
            const user = currentDriver(socket);
            if (!user) {
                socket.emit("tracking:error", { code: "UNAUTHENTICATED", message: "Driver authentication required" });
                return;
            }
            const rideId = parseTripIdFromPayload(payload);
            if (!rideId) {
                socket.emit("tracking:error", { code: "INVALID_RIDE_ID", message: "tripId / rideRequestId required" });
                return;
            }
            const result = await updateRideStatusForDriver(user.id, rideId, "started", io);
            if (!result.ok) emitTrackingError(socket, result);
        } catch (err) {
            console.error("startTrip error:", err);
            socket.emit("tracking:error", { code: "INTERNAL", message: "Failed to start trip" });
        }
    });

    socket.on("endTrip", async (payload) => {
        try {
            const user = currentDriver(socket);
            if (!user) {
                socket.emit("tracking:error", { code: "UNAUTHENTICATED", message: "Driver authentication required" });
                return;
            }
            const rideId = parseTripIdFromPayload(payload);
            if (!rideId) {
                socket.emit("tracking:error", { code: "INVALID_RIDE_ID", message: "tripId / rideRequestId required" });
                return;
            }
            const tips = payload?.tips;
            const result = await completeRideForDriver(user.id, rideId, { tips }, io);
            if (!result.ok) emitTrackingError(socket, result);
        } catch (err) {
            console.error("endTrip error:", err);
            socket.emit("tracking:error", { code: "INTERNAL", message: "Failed to complete trip" });
        }
    });
}
