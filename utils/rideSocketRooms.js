/**
 * Ride Socket.IO room join/leave shared by legacy events (`subscribe-ride`)
 * and Flutter aliases (`joinChat` / `leaveChat`).
 */

import prisma from "./prisma.js";

/** Parse ride id from a number, string, or object with rideRequestId / rideId. */
export function parseRideIdForRoom(payload) {
    if (payload == null) return null;
    if (typeof payload === "number" && Number.isFinite(payload)) return Math.trunc(payload);
    if (typeof payload === "string") {
        const n = parseInt(String(payload).trim(), 10);
        return Number.isNaN(n) ? null : n;
    }
    if (typeof payload === "object") {
        const r = payload.rideRequestId ?? payload.rideId ?? payload.ride_id ?? payload.tripId ?? payload.trip_id;
        if (r != null) return parseRideIdForRoom(r);
    }
    return null;
}

function ensureRideRoomsSet(socket) {
    if (!socket.data.rideRooms) socket.data.rideRooms = new Set();
    return socket.data.rideRooms;
}

function chatPresenceEnabled() {
    return String(process.env.RIDE_CHAT_PRESENCE || "").trim() === "1";
}

function trackingPresenceEnabled() {
    return String(process.env.RIDE_TRACKING_PRESENCE || "").trim() === "1";
}

function emitTrackingPresenceJoin(io, socket, rideIdInt, userId) {
    if (!trackingPresenceEnabled() || !io) return;
    const room = `ride-${rideIdInt}`;
    const payload = { rideRequestId: rideIdInt, tripId: rideIdInt, userId };
    socket.to(room).emit("trackingReconnected", payload);
}

function emitTrackingPresenceLeave(io, socket, rideIdInt, userId) {
    if (!trackingPresenceEnabled() || !io) return;
    const room = `ride-${rideIdInt}`;
    const payload = { rideRequestId: rideIdInt, tripId: rideIdInt, userId };
    socket.to(room).emit("trackingDisconnected", payload);
}

function emitRideChatPresenceJoin(io, socket, rideIdInt, userId) {
    if (!chatPresenceEnabled() || !io) return;
    const room = `ride-${rideIdInt}`;
    const payload = { rideRequestId: rideIdInt, userId, online: true };
    socket.to(room).emit("onlineStatusChanged", payload);
    socket.to(room).emit("userOnline", payload);
}

function emitRideChatPresenceLeave(io, socket, rideIdInt, userId) {
    if (!chatPresenceEnabled() || !io) return;
    const room = `ride-${rideIdInt}`;
    const payload = { rideRequestId: rideIdInt, userId, online: false };
    socket.to(room).emit("onlineStatusChanged", payload);
    socket.to(room).emit("userOffline", payload);
}

/**
 * @param {import("socket.io").Socket} socket
 * @param {unknown} rawPayload
 * @param {{ socketAuthEnforced: boolean; io: import("socket.io").Server }} ctx
 * @returns {Promise<{ ok: boolean; rideIdInt?: number }>}
 */
export async function subscribeSocketToRide(socket, rawPayload, { socketAuthEnforced, io }) {
    const rideIdInt = parseRideIdForRoom(rawPayload);
    if (rideIdInt == null || Number.isNaN(rideIdInt)) {
        if (socketAuthEnforced) {
            socket.emit("socket-auth-error", { success: false, message: "Invalid ride id" });
        }
        return { ok: false };
    }

    if (socketAuthEnforced) {
        const currentUser = socket.data.user;
        if (!currentUser) {
            socket.emit("socket-auth-error", { success: false, message: "Authentication required" });
            return { ok: false };
        }

        const isPrivileged = !["rider", "driver"].includes(currentUser.userType);
        if (!isPrivileged) {
            const ride = await prisma.rideRequest.findUnique({
                where: { id: rideIdInt },
                select: { riderId: true, driverId: true },
            });
            const allowed =
                !!ride &&
                (Number(ride.riderId) === Number(currentUser.id) ||
                    Number(ride.driverId) === Number(currentUser.id));
            if (!allowed) {
                socket.emit("socket-auth-error", { success: false, message: "Not authorized for ride room" });
                return { ok: false };
            }
        }
    }

    socket.join(`ride-${rideIdInt}`);
    ensureRideRoomsSet(socket).add(rideIdInt);
    const uid = socket.data?.user?.id;
    if (uid != null) {
        emitRideChatPresenceJoin(io, socket, rideIdInt, uid);
        emitTrackingPresenceJoin(io, socket, rideIdInt, uid);
    }
    return { ok: true, rideIdInt };
}

/**
 * @param {import("socket.io").Socket} socket
 * @param {unknown} rawPayload
 * @param {import("socket.io").Server} io
 */
export function unsubscribeSocketFromRide(socket, rawPayload, io) {
    const rideIdInt = parseRideIdForRoom(rawPayload);
    if (rideIdInt == null || Number.isNaN(rideIdInt)) {
        return { ok: false };
    }
    socket.leave(`ride-${rideIdInt}`);
    if (socket.data.rideRooms) socket.data.rideRooms.delete(rideIdInt);
    const uid = socket.data?.user?.id;
    if (uid != null) {
        emitRideChatPresenceLeave(io, socket, rideIdInt, uid);
        emitTrackingPresenceLeave(io, socket, rideIdInt, uid);
    }
    return { ok: true, rideIdInt };
}

/**
 * On socket disconnect: notify ride rooms that user went offline (presence).
 * @param {import("socket.io").Server} io
 * @param {import("socket.io").Socket} socket
 */
export function emitPresenceOfflineForSocketRooms(io, socket) {
    if (!io) return;
    const uid = socket.data?.user?.id;
    const rooms = socket.data?.rideRooms;
    if (uid == null || !rooms || rooms.size === 0) return;
    for (const rideIdInt of rooms) {
        if (chatPresenceEnabled()) {
            const payload = { rideRequestId: rideIdInt, userId: uid, online: false };
            io.to(`ride-${rideIdInt}`).emit("onlineStatusChanged", payload);
            io.to(`ride-${rideIdInt}`).emit("userOffline", payload);
        }
        if (trackingPresenceEnabled()) {
            io.to(`ride-${rideIdInt}`).emit("trackingDisconnected", {
                rideRequestId: rideIdInt,
                tripId: rideIdInt,
                userId: uid,
            });
        }
    }
}
