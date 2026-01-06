/**
 * Socket.IO service for real-time communication
 * This service provides helper functions to emit events via Socket.IO
 */

/**
 * Emit event to specific user
 */
export const emitToUser = (io, userId, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    io.to(`user-${userId}`).emit(event, data);
};

/**
 * Emit event to specific driver
 */
export const emitToDriver = (io, driverId, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    io.to(`driver-${driverId}`).emit(event, data);
};

/**
 * Emit event to all users in a ride
 */
export const emitToRide = (io, rideId, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
    io.to(`ride-${rideId}`).emit(event, data);
};

/**
 * Emit event to all connected clients
 */
export const emitToAll = (io, event, data) => {
    if (!io) {
        console.warn("Socket.IO not initialized");
        return;
    }
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
        io.to(`driver-${driverId}`).emit("new_ride_request", rideRequest);
    });
};

