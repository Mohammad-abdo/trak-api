/**
 * Socket.IO service for real-time communication
 * This service provides helper functions to emit events via Socket.IO
 */

function shouldLogSocketEmits() {
    const lvl = String(process.env.SOCKET_LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug")).toLowerCase();
    return lvl !== "off";
}

function logEmit(scope, room, event, data) {
    if (!shouldLogSocketEmits()) return;
    const logPayload = process.env.SOCKET_LOG_PAYLOAD === "1";
    const meta = { scope, room, event };
    if (logPayload) meta.payload = data;
    console.log(`[socket:emit] ${JSON.stringify(meta)}`);
}

/**
 * Emit event to specific user
 */
export const emitToUser = (io, userId, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    const room = `user-${userId}`;
    logEmit("user", room, event, data);
    io.to(room).emit(event, data);
};

/**
 * Emit event to specific driver
 */
export const emitToDriver = (io, driverId, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    const room = `driver-${driverId}`;
    logEmit("driver", room, event, data);
    io.to(room).emit(event, data);
};

/**
 * Emit event to all users in a ride
 */
export const emitToRide = (io, rideId, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    const room = `ride-${rideId}`;
    logEmit("ride", room, event, data);
    io.to(room).emit(event, data);
};

/**
 * Emit event to all connected clients
 */
export const emitToAll = (io, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    logEmit("all", "*", event, data);
    io.emit(event, data);
};

/**
 * Emit event to all drivers
 */
export const emitToAllDrivers = (io, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    // This would require tracking which sockets are drivers
    // For now, emit to all and let clients filter
    logEmit("allDrivers", "*", event, data);
    io.emit(event, data);
};

/**
 * Emit ride request to nearby drivers
 */
export const emitRideRequestToDrivers = (io, driverIds, rideRequest) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    driverIds.forEach((driverId) => {
        const room = `driver-${driverId}`;
        logEmit("driver", room, "new_ride_request", rideRequest);
        io.to(room).emit("new_ride_request", rideRequest);
    });
};

/**
 * Broadcast driver location update to all clients (e.g. admin tracking page)
 */
export const emitDriverLocationUpdate = (io, driverId, data) => {
    if (!io) return;
    const lat = data.latitude ?? data.lat;
    const lng = data.longitude ?? data.lng;
    io.emit("driver-location-update", {
        driverId,
        lat,
        lng,
        heading: data.currentHeading ?? data.heading ?? undefined,
        name:
            data.firstName || data.lastName
                ? `${data.firstName || ""} ${data.lastName || ""}`.trim()
                : undefined,
        status: data.isOnline ? (data.isAvailable ? "online" : "busy") : "offline",
        isAvailable: data.isAvailable,
    });
};

