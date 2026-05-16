import prisma from "../utils/prisma.js";
import { parseRideRequestIdParam, pickRideRequestIdFromBody } from "../utils/rideRequestId.js";
import { getDriverAndSystemShare } from "../utils/settingsHelper.js";
import { emitDriverLocationUpdate } from "../utils/socketService.js";
import {
    emitDriverLocationForRide,
    emitRideStatusChange,
    emitTripCompleted,
} from "../utils/rideTrackingBroadcast.js";
import { buildDriverLocationRidePayload, parseLocationFromPayload, parseTripIdFromPayload } from "../utils/rideTrackingPayload.js";
import { emitDriverTripSyncForRideId } from "../utils/driverTripSocketSync.js";
import { replayPendingRidesForDriver } from "../utils/replayPendingRidesForDriver.js";

const LOCATION_RATE_MAX = 60;
const LOCATION_RATE_WINDOW_MS = 10_000;
const locationBuckets = new Map();

function locationBucketKey(driverId) {
    return String(driverId);
}

function checkLocationRateLimit(driverId) {
    const key = locationBucketKey(driverId);
    const now = Date.now();
    const arr = locationBuckets.get(key) || [];
    const fresh = arr.filter((t) => now - t < LOCATION_RATE_WINDOW_MS);
    if (fresh.length >= LOCATION_RATE_MAX) {
        locationBuckets.set(key, fresh);
        return { ok: false };
    }
    fresh.push(now);
    locationBuckets.set(key, fresh);
    return { ok: true };
}

function fail(statusCode, code, message) {
    return { ok: false, statusCode, code, message };
}

function ok(data, message) {
    return { ok: true, data, message };
}

async function assertDriverOwnsRide(driverId, rideId) {
    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) return { ride: null, error: fail(404, "RIDE_NOT_FOUND", "Ride not found") };
    if (ride.driverId !== driverId) return { ride: null, error: fail(403, "NOT_AUTHORIZED", "Not authorized") };
    return { ride, error: null };
}

function getIo(ioOverride) {
    return ioOverride || global.io || null;
}

/**
 * @param {number} driverId
 * @param {object} location - { latitude, longitude, currentHeading? }
 * @param {import("socket.io").Server | null | undefined} ioOverride
 */
export async function updateDriverLocation(driverId, location, ioOverride) {
    const { latitude, longitude, currentHeading } = location || {};
    if (!latitude || !longitude) {
        return fail(400, "INVALID_LOCATION", "latitude and longitude are required");
    }

    const rate = checkLocationRateLimit(driverId);
    if (!rate.ok) return fail(429, "RATE_LIMITED", "Too many location updates");

    await prisma.user.update({
        where: { id: driverId },
        data: {
            latitude: String(latitude),
            longitude: String(longitude),
            currentHeading: currentHeading != null ? parseFloat(currentHeading) : undefined,
            lastLocationUpdateAt: new Date(),
        },
    });

    const driverLat = parseFloat(latitude);
    const driverLng = parseFloat(longitude);
    const io = getIo(ioOverride);

    if (io) {
        emitDriverLocationUpdate(io, driverId, {
            latitude,
            longitude,
            currentHeading,
            heading: currentHeading,
        });

        const activeRides = await prisma.rideRequest.findMany({
            where: {
                driverId,
                status: { in: ["accepted", "arrived", "started"] },
            },
            select: { id: true },
        });

        for (const r of activeRides) {
            const payload = buildDriverLocationRidePayload(
                r.id,
                driverId,
                latitude,
                longitude,
                currentHeading
            );
            emitDriverLocationForRide(io, r.id, payload);
        }

        prisma.user
            .findUnique({
                where: { id: driverId },
                select: { isOnline: true, isAvailable: true },
            })
            .then((u) => {
                if (u?.isOnline && u?.isAvailable) {
                    return replayPendingRidesForDriver(io, driverId, driverLat, driverLng);
                }
            })
            .catch(() => {});
    }

    return ok({ latitude, longitude }, "Location updated");
}

/**
 * @param {number} driverId
 * @param {unknown} rawRideId
 * @param {"arrived"|"started"} status
 * @param {import("socket.io").Server | null | undefined} ioOverride
 */
export async function updateRideStatusForDriver(driverId, rawRideId, status, ioOverride) {
    const allowed = ["arrived", "started"];
    if (!allowed.includes(status)) {
        return fail(400, "INVALID_STATUS", `status must be one of: ${allowed.join(", ")}`);
    }

    const rideId = parseRideRequestIdParam(rawRideId) ?? parseTripIdFromPayload({ tripId: rawRideId });
    if (!rideId) return fail(400, "INVALID_RIDE_ID", "Invalid rideRequestId (use numeric id or tripId)");

    const { ride, error } = await assertDriverOwnsRide(driverId, rideId);
    if (error) return error;

    const updated = await prisma.rideRequest.update({ where: { id: ride.id }, data: { status } });

    const io = getIo(ioOverride);
    const payload = {
        rideRequestId: ride.id,
        tripId: ride.id,
        driverId,
        status,
    };
    if (io) emitRideStatusChange(io, ride.id, status, payload);
    if (io) emitDriverTripSyncForRideId(io, ride.id, `ride_status_${status}`);

    return ok(updated, `Ride status updated to ${status}`);
}

/**
 * @param {number} driverId
 * @param {unknown} rawRideId
 * @param {{ tips?: number }} [opts]
 * @param {import("socket.io").Server | null | undefined} ioOverride
 */
export async function completeRideForDriver(driverId, rawRideId, opts = {}, ioOverride) {
    const rideId = parseRideRequestIdParam(rawRideId) ?? parseTripIdFromPayload({ tripId: rawRideId });
    if (!rideId) return fail(400, "INVALID_RIDE_ID", "Invalid rideRequestId (use numeric id or tripId)");

    const { ride, error } = await assertDriverOwnsRide(driverId, rideId);
    if (error) return error;

    const tips = opts.tips;
    const effectiveFare =
        ride.negotiationStatus === "accepted" && ride.negotiatedFare != null
            ? parseFloat(ride.negotiatedFare)
            : parseFloat(ride.totalAmount);
    const totalAmount = effectiveFare + (parseFloat(tips) || 0);

    await prisma.rideRequest.update({
        where: { id: ride.id },
        data: { status: "completed", tips: tips || 0, totalAmount },
    });

    await prisma.payment.create({
        data: {
            rideRequestId: ride.id,
            userId: ride.riderId,
            driverId: ride.driverId,
            amount: totalAmount,
            paymentType: ride.paymentType,
            paymentStatus: ride.paymentType === "cash" ? "paid" : "pending",
        },
    });

    if (ride.paymentType === "cash" && ride.driverId && totalAmount > 0) {
        const { driverShare } = await getDriverAndSystemShare(Number(totalAmount));
        let wallet = await prisma.wallet.findUnique({ where: { userId: ride.driverId } });
        if (!wallet) wallet = await prisma.wallet.create({ data: { userId: ride.driverId, balance: 0 } });
        const newBalance = Math.round((parseFloat(wallet.balance) + (driverShare > 0 ? driverShare : 0)) * 100) / 100;
        await prisma.wallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
        await prisma.walletHistory.create({
            data: {
                walletId: wallet.id,
                userId: ride.driverId,
                type: "credit",
                amount: Number(totalAmount),
                balance: newBalance,
                description:
                    ride.negotiationStatus === "accepted"
                        ? "Ride earnings (cash) — negotiated fare"
                        : "Ride earnings (cash)",
                transactionType: "ride_earnings",
                rideRequestId: ride.id,
            },
        });
    }

    const io = getIo(ioOverride);
    const payload = {
        rideRequestId: ride.id,
        tripId: ride.id,
        driverId,
        totalAmount,
    };
    if (io) emitTripCompleted(io, ride.id, payload);
    if (io) emitDriverTripSyncForRideId(io, ride.id, "ride_completed");

    const updated = await prisma.rideRequest.findUnique({ where: { id: ride.id } });
    return ok(updated, "Ride completed successfully");
}

/** REST body helpers */
export function parseRideIdFromHttpBody(body) {
    return parseRideRequestIdParam(pickRideRequestIdFromBody(body));
}

export { parseLocationFromPayload, parseTripIdFromPayload };
