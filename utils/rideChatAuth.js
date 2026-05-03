/**
 * Authorization + lifecycle helper for ride-chat.
 *
 * Chat between a rider (client) and the assigned driver is only usable while
 * the ride is in an "active" lifecycle state (i.e. the driver has already
 * accepted the trip and the ride has not ended). Read access is allowed for
 * the same parties for the lifetime of the ride so that both sides can see
 * the history even after the ride closes.
 */

import prisma from "./prisma.js";
import { parseRideRequestIdParam } from "./rideRequestId.js";

// Statuses where the chat is OPEN for writing.
// If you need different transitions, just add/remove entries here — no other
// file needs to change.
export const CHAT_WRITABLE_STATUSES = new Set([
    "accepted",
    "scheduled",
    "negotiating",
    "counter_offered",
    "arrived",
    "arrived_at_pickup",
    "started",
    "ongoing",
    "in_progress",
]);

// Statuses where the chat is READ-ONLY (history browsable).
export const CHAT_READABLE_STATUSES = new Set([
    ...CHAT_WRITABLE_STATUSES,
    "completed",
    "cancelled",
    "canceled",
]);

/**
 * @typedef {Object} ChatAccessResult
 * @property {boolean} ok
 * @property {number} [statusCode]
 * @property {string} [code]
 * @property {string} [message]
 * @property {object} [ride]
 * @property {"rider"|"driver"} [senderType]
 */

/**
 * Validates that the given user can access the chat for the given ride id.
 * @param {{ id: number, userType?: string }} user
 * @param {unknown} rawRideId
 * @param {{ requireWrite?: boolean }} [opts]
 * @returns {Promise<ChatAccessResult>}
 */
export async function resolveRideChatAccess(user, rawRideId, opts = {}) {
    const requireWrite = opts.requireWrite === true;
    if (!user || !user.id) {
        return { ok: false, statusCode: 401, code: "UNAUTHENTICATED", message: "Authentication required" };
    }

    const rideId = parseRideRequestIdParam(rawRideId);
    if (!rideId) {
        return { ok: false, statusCode: 400, code: "INVALID_RIDE_ID", message: "Invalid ride id" };
    }

    const ride = await prisma.rideRequest.findUnique({
        where: { id: rideId },
        select: { id: true, riderId: true, driverId: true, status: true },
    });

    if (!ride) {
        return { ok: false, statusCode: 404, code: "RIDE_NOT_FOUND", message: "Ride not found" };
    }

    const isRider = Number(ride.riderId) === Number(user.id);
    const isDriver = ride.driverId != null && Number(ride.driverId) === Number(user.id);

    if (!isRider && !isDriver) {
        return {
            ok: false,
            statusCode: 403,
            code: "NOT_A_PARTICIPANT",
            message: "You are not a participant of this ride",
        };
    }

    const status = (ride.status || "").toLowerCase();
    const hasAssignedDriver = ride.driverId != null;

    if (requireWrite) {
        // Compatibility: some flows keep status as "pending" briefly even after
        // assigning a driver; allow chat only when both parties are already bound.
        const pendingButAssigned = status === "pending" && hasAssignedDriver;
        if (!CHAT_WRITABLE_STATUSES.has(status) && !pendingButAssigned) {
            return {
                ok: false,
                statusCode: 403,
                code: "CHAT_NOT_OPEN",
                message: "Chat is not available for this ride yet",
                ride,
            };
        }
    } else if (!CHAT_READABLE_STATUSES.has(status)) {
        return {
            ok: false,
            statusCode: 403,
            code: "CHAT_NOT_AVAILABLE",
            message: "Chat history is not available for this ride",
            ride,
        };
    }

    return {
        ok: true,
        ride,
        senderType: isDriver ? "driver" : "rider",
    };
}

/**
 * Lightweight per-user, per-ride, in-memory rate limiter for chat messages.
 * Token-bucket style: N messages per window.
 * Not distributed — good enough for a single node and prevents accidental
 * flooding. If we scale horizontally later we can swap this for Redis.
 */
const RATE_LIMIT_MAX = 20; // messages
const RATE_LIMIT_WINDOW_MS = 10_000; // per 10 seconds
const rateBuckets = new Map(); // key -> number[] timestamps

function bucketKey(userId, rideId) {
    return `${userId}:${rideId}`;
}

export function checkChatRateLimit(userId, rideId) {
    const key = bucketKey(userId, rideId);
    const now = Date.now();
    const arr = rateBuckets.get(key) || [];
    const fresh = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (fresh.length >= RATE_LIMIT_MAX) {
        rateBuckets.set(key, fresh);
        return { ok: false, retryInMs: RATE_LIMIT_WINDOW_MS - (now - fresh[0]) };
    }
    fresh.push(now);
    rateBuckets.set(key, fresh);
    return { ok: true };
}

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export function sanitizeChatMessage(raw) {
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
        return trimmed.slice(0, CHAT_MESSAGE_MAX_LENGTH);
    }
    return trimmed;
}
