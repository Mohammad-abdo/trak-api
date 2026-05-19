import prisma from "../utils/prisma.js";
import {
    emitDriverOfferCancelled,
    emitDriverOfferRejected,
    emitRideNegotiationRejectedByRider,
} from "../utils/driverOfferBroadcast.js";
import { emitDriverTripSyncForRideId } from "../utils/driverTripSocketSync.js";

const TERMINAL_STATUSES = new Set([
    "completed",
    "cancelled",
    "canceled",
    "in_progress",
    "started",
    "arrived",
    "reached",
    "end",
]);

export function parseRejectedBidDriverIds(json) {
    if (json == null) return [];
    let raw = json;
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.map((v) => parseInt(v, 10)).filter((id) => Number.isInteger(id) && id > 0))];
}

function appendRejectedDriverIds(current, driverId) {
    const ids = parseRejectedBidDriverIds(current);
    if (!ids.includes(driverId)) ids.push(driverId);
    return ids;
}

const CLEAR_NEGOTIATION = {
    negotiationStatus: "none",
    negotiatedFare: null,
    negotiationExpiresAt: null,
    negotiationRounds: 0,
    lastNegotiationBy: null,
};

async function deleteDriverBids(rideId, driverId) {
    await prisma.rideRequestBid.deleteMany({
        where: { rideRequestId: rideId, driverId },
    });
}

async function rejectPendingBidOnly(rideId, driverId, rejectedBidDriverIds) {
    const nextRejected = appendRejectedDriverIds(rejectedBidDriverIds, driverId);
    await prisma.$transaction([
        prisma.rideRequestBid.deleteMany({ where: { rideRequestId: rideId, driverId } }),
        prisma.rideRequest.update({
            where: { id: rideId },
            data: { rejectedBidDriverIds: nextRejected },
        }),
    ]);
    return nextRejected;
}

async function unassignDriverFromRide(rideId, driverId, rejectedBidDriverIds, extraData = {}) {
    const nextRejected = appendRejectedDriverIds(rejectedBidDriverIds, driverId);
    await prisma.$transaction([
        prisma.rideRequestBid.deleteMany({ where: { rideRequestId: rideId, driverId } }),
        prisma.rideRequest.update({
            where: { id: rideId },
            data: {
                driverId: null,
                riderequestInDriverId: null,
                status: "pending",
                otp: null,
                rejectedBidDriverIds: nextRejected,
                ...CLEAR_NEGOTIATION,
                ...extraData,
            },
        }),
    ]);
}

function emitRejectSockets(io, booking, driverId, branch, previousStatus) {
    if (!io) return;

    emitDriverOfferRejected(io, {
        rideRequestId: booking.id,
        riderId: booking.riderId,
        driverId,
        rideStatus: "pending",
        previousStatus,
    });

    if (branch === "negotiating") {
        emitRideNegotiationRejectedByRider(io, {
            rideRequestId: booking.id,
            riderId: booking.riderId,
            driverId,
            baseFare: booking.totalAmount,
        });
    }

    if (branch === "accepted") {
        emitDriverOfferCancelled(io, {
            rideRequestId: booking.id,
            riderId: booking.riderId,
            driverId,
        });
    }

    emitDriverTripSyncForRideId(io, booking.id, "rider_rejected_offer", driverId);
}

/**
 * @returns {Promise<
 *   | { ok: true; branch: string; rideId: number; status: string; alreadyRejected?: boolean; message: string }
 *   | { ok: false; httpStatus: number; code: string; message: string }
 * >}
 */
export async function rejectDriverOfferForBooking({ rideId, riderId, driverId, io = null }) {
    const booking = await prisma.rideRequest.findFirst({
        where: { id: rideId, riderId },
        select: {
            id: true,
            riderId: true,
            status: true,
            driverId: true,
            rejectedBidDriverIds: true,
            totalAmount: true,
            negotiatedFare: true,
            negotiationStatus: true,
        },
    });

    if (!booking) {
        return {
            ok: false,
            httpStatus: 404,
            code: "BOOKING_NOT_FOUND",
            message: "Booking not found",
        };
    }

    if (TERMINAL_STATUSES.has(booking.status)) {
        return {
            ok: false,
            httpStatus: 400,
            code: "INVALID_BOOKING_STATE",
            message: `Cannot reject offer on a ride with status '${booking.status}'`,
        };
    }

    const rejectedIds = parseRejectedBidDriverIds(booking.rejectedBidDriverIds);
    const alreadyRejected = rejectedIds.includes(driverId);

    const bid = await prisma.rideRequestBid.findFirst({
        where: { rideRequestId: rideId, driverId },
        select: { id: true },
    });

    const previousStatus = booking.status;

    // --- Branch C: accepted + matching driver ---
    if (booking.status === "accepted" && booking.driverId === driverId) {
        await unassignDriverFromRide(rideId, driverId, booking.rejectedBidDriverIds);
        emitRejectSockets(io, booking, driverId, "accepted", previousStatus);
        return {
            ok: true,
            branch: "accepted",
            rideId,
            status: "pending",
            message: "Driver offer cancelled. You can select another driver.",
        };
    }

    if (booking.status === "accepted" && booking.driverId && booking.driverId !== driverId) {
        return {
            ok: false,
            httpStatus: 400,
            code: "DRIVER_NOT_ON_BOOKING",
            message: "Driver does not match this booking",
        };
    }

    // --- Branch B: negotiating + matching driver ---
    if (booking.status === "negotiating") {
        if (booking.driverId !== driverId) {
            return {
                ok: false,
                httpStatus: 400,
                code: "DRIVER_NOT_ON_BOOKING",
                message: "Driver does not match this booking",
            };
        }
        await unassignDriverFromRide(rideId, driverId, booking.rejectedBidDriverIds);
        emitRejectSockets(io, booking, driverId, "negotiating", previousStatus);
        return {
            ok: true,
            branch: "negotiating",
            rideId,
            status: "pending",
            message: "Driver offer rejected.",
        };
    }

    // --- Branch A: pending / scheduled — bid or respond-flow on ride ---
    const openStatuses = new Set(["pending", "scheduled"]);
    if (openStatuses.has(booking.status)) {
        if (booking.driverId === driverId) {
            await unassignDriverFromRide(rideId, driverId, booking.rejectedBidDriverIds);
            emitRejectSockets(io, booking, driverId, "pending_unassign", previousStatus);
            return {
                ok: true,
                branch: "pending_unassign",
                rideId,
                status: "pending",
                message: "Driver offer rejected.",
            };
        }

        if (alreadyRejected && !bid) {
            return {
                ok: true,
                branch: "pending_bid",
                rideId,
                status: booking.status,
                alreadyRejected: true,
                message: "Offer already rejected",
            };
        }

        if (!bid && !alreadyRejected) {
            return {
                ok: false,
                httpStatus: 400,
                code: "NO_OFFER_FROM_DRIVER",
                message: "No offer from this driver on this booking",
            };
        }

        await rejectPendingBidOnly(rideId, driverId, booking.rejectedBidDriverIds);
        emitRejectSockets(io, booking, driverId, "pending_bid", previousStatus);
        return {
            ok: true,
            branch: "pending_bid",
            rideId,
            status: booking.status,
            message: "Driver offer rejected.",
        };
    }

    if (booking.driverId === driverId) {
        return {
            ok: false,
            httpStatus: 400,
            code: "INVALID_BOOKING_STATE",
            message: `Cannot reject offer on a ride with status '${booking.status}'`,
        };
    }

    return {
        ok: false,
        httpStatus: 400,
        code: "INVALID_BOOKING_STATE",
        message: `Cannot reject offer on a ride with status '${booking.status}'`,
    };
}
