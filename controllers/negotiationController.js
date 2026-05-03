import prisma from "../utils/prisma.js";
import { parseRideRequestIdParam } from "../utils/rideRequestId.js";
import {
    getNegotiationSettings,
    validateFareBounds,
    computeExpiresAt,
} from "../utils/negotiationHelper.js";
import { emitToUser, emitToDriver } from "../utils/socketService.js";
import { emitDriverTripSyncFromReq } from "../utils/driverTripSocketSync.js";

/** Notify driver/rider rooms only (avoids duplicate delivery if a socket joined both driver-* and ride-*). */
function emitNegotiationSocket(req, event, payload) {
    try {
        const io = req.app?.get?.("io") || global.io;
        if (!io) return;
        const { driverId, riderId } = payload;
        if (driverId) emitToDriver(io, driverId, event, payload);
        if (riderId) emitToUser(io, riderId, event, payload);
    } catch (_) {
        /* non-fatal */
    }
}

// ---------------------------------------------------------------------------
// @desc    Get negotiation settings (public — mobile apps use this)
// @route   GET /api/negotiations/settings
// @access  Public
// ---------------------------------------------------------------------------
export const getSettings = async (_req, res) => {
    try {
        const settings = await getNegotiationSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        console.error("Get negotiation settings error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// @desc    Start negotiation — rider proposes a new fare
// @route   POST /api/negotiations/start
// @access  Private (rider)
// @body    { rideRequestId, proposedFare }
// ---------------------------------------------------------------------------
export const startNegotiation = async (req, res) => {
    try {
        const { rideRequestId, proposedFare } = req.body;
        if (!rideRequestId || proposedFare == null) {
            return res.status(400).json({ success: false, message: "rideRequestId and proposedFare are required" });
        }
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const settings = await getNegotiationSettings();
        if (!settings.enabled) {
            return res.status(403).json({ success: false, message: "Negotiation is disabled" });
        }

        const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!ride) return res.status(404).json({ success: false, message: "Ride request not found" });
        if (ride.riderId !== req.user.id) {
            return res.status(403).json({ success: false, message: "Only the rider can start negotiation" });
        }
        if (!["pending", "accepted"].includes(ride.status)) {
            return res.status(400).json({ success: false, message: `Cannot negotiate on a ride with status '${ride.status}'` });
        }
        if (ride.negotiationStatus !== "none" && ride.negotiationStatus !== "rejected" && ride.negotiationStatus !== "expired") {
            return res.status(400).json({ success: false, message: `Negotiation already in progress (${ride.negotiationStatus})` });
        }

        const baseFare = ride.totalAmount;
        const { valid, percentChange, message } = validateFareBounds(baseFare, parseFloat(proposedFare), settings.maxPercent);
        if (!valid) return res.status(400).json({ success: false, message });

        const expiresAt = computeExpiresAt(settings.timeoutSeconds);

        const [updatedRide, history] = await prisma.$transaction([
            prisma.rideRequest.update({
                where: { id: ride.id },
                data: {
                    negotiatedFare: parseFloat(proposedFare),
                    negotiationStatus: "pending",
                    negotiationMaxPercent: settings.maxPercent,
                    lastNegotiationBy: "rider",
                    negotiationRounds: 1,
                    negotiationExpiresAt: expiresAt,
                },
            }),
            prisma.rideNegotiation.create({
                data: {
                    rideRequestId: ride.id,
                    proposedBy: "rider",
                    proposedFare: parseFloat(proposedFare),
                    percentChange,
                    action: "propose",
                    round: 1,
                },
            }),
        ]);

        emitDriverTripSyncFromReq(req, ride.id, "negotiation_start_rider");

        res.json({
            success: true,
            message: "Negotiation started",
            data: {
                rideRequestId: ride.id,
                baseFare,
                proposedFare: updatedRide.negotiatedFare,
                percentChange,
                negotiationStatus: updatedRide.negotiationStatus,
                expiresAt,
                round: 1,
                maxRounds: settings.maxRounds,
            },
        });
    } catch (error) {
        console.error("Start negotiation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// @desc    Counter-offer — driver or rider proposes a different fare
// @route   POST /api/negotiations/counter
// @access  Private (rider or driver)
// @body    { rideRequestId, proposedFare }
// ---------------------------------------------------------------------------
export const counterOffer = async (req, res) => {
    try {
        const { rideRequestId, proposedFare } = req.body;
        if (!rideRequestId || proposedFare == null) {
            return res.status(400).json({ success: false, message: "rideRequestId and proposedFare are required" });
        }
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const settings = await getNegotiationSettings();
        if (!settings.enabled) {
            return res.status(403).json({ success: false, message: "Negotiation is disabled" });
        }

        const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!ride) return res.status(404).json({ success: false, message: "Ride request not found" });

        const userId = req.user.id;
        const isRider = ride.riderId === userId;
        const isDriver = ride.driverId === userId;
        if (!isRider && !isDriver) {
            return res.status(403).json({ success: false, message: "Not authorized for this ride" });
        }

        if (!["pending", "counter_offered"].includes(ride.negotiationStatus)) {
            return res.status(400).json({ success: false, message: `Cannot counter-offer on status '${ride.negotiationStatus}'` });
        }

        const proposerRole = isRider ? "rider" : "driver";
        if (ride.lastNegotiationBy === proposerRole) {
            return res.status(400).json({ success: false, message: "Wait for the other party to respond" });
        }

        if (ride.negotiationExpiresAt && new Date() > new Date(ride.negotiationExpiresAt)) {
            await prisma.rideRequest.update({
                where: { id: ride.id },
                data: { negotiationStatus: "expired" },
            });
            emitDriverTripSyncFromReq(req, ride.id, "negotiation_expired_on_action", ride.driverId);
            return res.status(400).json({ success: false, message: "Negotiation has expired" });
        }

        const newRound = ride.negotiationRounds + 1;
        if (newRound > settings.maxRounds) {
            return res.status(400).json({ success: false, message: `Max negotiation rounds (${settings.maxRounds}) reached` });
        }

        const baseFare = ride.totalAmount;
        const { valid, percentChange, message } = validateFareBounds(baseFare, parseFloat(proposedFare), settings.maxPercent);
        if (!valid) return res.status(400).json({ success: false, message });

        const expiresAt = computeExpiresAt(settings.timeoutSeconds);

        const [updatedRide, history] = await prisma.$transaction([
            prisma.rideRequest.update({
                where: { id: ride.id },
                data: {
                    negotiatedFare: parseFloat(proposedFare),
                    negotiationStatus: "counter_offered",
                    lastNegotiationBy: proposerRole,
                    negotiationRounds: newRound,
                    negotiationExpiresAt: expiresAt,
                },
            }),
            prisma.rideNegotiation.create({
                data: {
                    rideRequestId: ride.id,
                    proposedBy: proposerRole,
                    proposedFare: parseFloat(proposedFare),
                    percentChange,
                    action: "counter",
                    round: newRound,
                },
            }),
        ]);

        emitNegotiationSocket(req, "ride-negotiation-counter", {
            rideRequestId: ride.id,
            driverId: ride.driverId,
            riderId: ride.riderId,
            negotiationStatus: updatedRide.negotiationStatus,
            proposedBy: proposerRole,
            proposedFare: updatedRide.negotiatedFare != null ? parseFloat(updatedRide.negotiatedFare) : null,
            baseFare: baseFare != null ? parseFloat(baseFare) : null,
            percentChange,
            expiresAt,
            round: newRound,
            maxRounds: settings.maxRounds,
        });

        emitDriverTripSyncFromReq(req, ride.id, "negotiation_counter");

        res.json({
            success: true,
            message: "Counter-offer submitted",
            data: {
                rideRequestId: ride.id,
                baseFare,
                proposedFare: updatedRide.negotiatedFare,
                percentChange,
                negotiationStatus: updatedRide.negotiationStatus,
                expiresAt,
                round: newRound,
                maxRounds: settings.maxRounds,
            },
        });
    } catch (error) {
        console.error("Counter offer error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// @desc    Accept the current negotiated fare
// @route   POST /api/negotiations/accept
// @access  Private (rider or driver)
// @body    { rideRequestId }
// ---------------------------------------------------------------------------
export const acceptNegotiation = async (req, res) => {
    try {
        const { rideRequestId } = req.body;
        if (!rideRequestId) return res.status(400).json({ success: false, message: "rideRequestId is required" });
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!ride) return res.status(404).json({ success: false, message: "Ride request not found" });

        const userId = req.user.id;
        const isRider = ride.riderId === userId;
        const isDriver = ride.driverId === userId;
        if (!isRider && !isDriver) {
            return res.status(403).json({ success: false, message: "Not authorized for this ride" });
        }

        if (!["pending", "counter_offered"].includes(ride.negotiationStatus)) {
            return res.status(400).json({ success: false, message: `Cannot accept negotiation with status '${ride.negotiationStatus}'` });
        }

        if (ride.negotiationExpiresAt && new Date() > new Date(ride.negotiationExpiresAt)) {
            await prisma.rideRequest.update({
                where: { id: ride.id },
                data: { negotiationStatus: "expired" },
            });
            emitDriverTripSyncFromReq(req, ride.id, "negotiation_expired_on_action", ride.driverId);
            return res.status(400).json({ success: false, message: "Negotiation has expired" });
        }

        const accepterRole = isRider ? "rider" : "driver";
        const finalFare = ride.negotiatedFare ?? ride.totalAmount;
        const percentChange = ((finalFare - ride.totalAmount) / ride.totalAmount) * 100;

        const [updatedRide, history] = await prisma.$transaction([
            prisma.rideRequest.update({
                where: { id: ride.id },
                data: {
                    negotiationStatus: "accepted",
                    negotiatedFare: finalFare,
                    negotiationExpiresAt: null,
                },
            }),
            prisma.rideNegotiation.create({
                data: {
                    rideRequestId: ride.id,
                    proposedBy: accepterRole,
                    proposedFare: finalFare,
                    percentChange: Math.round(percentChange * 100) / 100,
                    action: "accept",
                    round: ride.negotiationRounds,
                },
            }),
        ]);

        emitNegotiationSocket(req, "ride-negotiation-accepted", {
            rideRequestId: ride.id,
            driverId: ride.driverId,
            riderId: ride.riderId,
            negotiationStatus: "accepted",
            negotiatedFare: finalFare != null ? parseFloat(finalFare) : null,
            baseFare: ride.totalAmount != null ? parseFloat(ride.totalAmount) : null,
            percentChange: Math.round(percentChange * 100) / 100,
            acceptedBy: accepterRole,
        });

        emitDriverTripSyncFromReq(req, ride.id, "negotiation_accept");

        res.json({
            success: true,
            message: "Negotiation accepted",
            data: {
                rideRequestId: ride.id,
                baseFare: ride.totalAmount,
                negotiatedFare: finalFare,
                percentChange: Math.round(percentChange * 100) / 100,
                negotiationStatus: "accepted",
            },
        });
    } catch (error) {
        console.error("Accept negotiation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// @desc    Reject / cancel negotiation — revert to base fare
// @route   POST /api/negotiations/reject
// @access  Private (rider or driver)
// @body    { rideRequestId }
// ---------------------------------------------------------------------------
export const rejectNegotiation = async (req, res) => {
    try {
        const { rideRequestId } = req.body;
        if (!rideRequestId) return res.status(400).json({ success: false, message: "rideRequestId is required" });
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!ride) return res.status(404).json({ success: false, message: "Ride request not found" });

        const userId = req.user.id;
        const isRider = ride.riderId === userId;
        const isDriver = ride.driverId === userId;
        if (!isRider && !isDriver) {
            return res.status(403).json({ success: false, message: "Not authorized for this ride" });
        }

        if (!["pending", "counter_offered"].includes(ride.negotiationStatus)) {
            return res.status(400).json({ success: false, message: `Cannot reject negotiation with status '${ride.negotiationStatus}'` });
        }

        const rejecterRole = isRider ? "rider" : "driver";

        const [updatedRide, history] = await prisma.$transaction([
            prisma.rideRequest.update({
                where: { id: ride.id },
                data: {
                    negotiationStatus: "rejected",
                    negotiatedFare: null,
                    negotiationExpiresAt: null,
                },
            }),
            prisma.rideNegotiation.create({
                data: {
                    rideRequestId: ride.id,
                    proposedBy: rejecterRole,
                    proposedFare: ride.totalAmount,
                    percentChange: 0,
                    action: "reject",
                    round: ride.negotiationRounds,
                },
            }),
        ]);

        emitNegotiationSocket(req, "ride-negotiation-rejected", {
            rideRequestId: ride.id,
            driverId: ride.driverId,
            riderId: ride.riderId,
            negotiationStatus: "rejected",
            negotiatedFare: null,
            baseFare: ride.totalAmount != null ? parseFloat(ride.totalAmount) : null,
            rejectedBy: rejecterRole,
        });

        emitDriverTripSyncFromReq(req, ride.id, "negotiation_reject");

        res.json({
            success: true,
            message: "Negotiation rejected — ride reverts to base fare",
            data: {
                rideRequestId: ride.id,
                baseFare: ride.totalAmount,
                negotiatedFare: null,
                negotiationStatus: "rejected",
            },
        });
    } catch (error) {
        console.error("Reject negotiation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ---------------------------------------------------------------------------
// @desc    Get negotiation history for a ride
// @route   GET /api/negotiations/history/:rideRequestId
// @access  Private
// ---------------------------------------------------------------------------
export const getNegotiationHistory = async (req, res) => {
    try {
        const { rideRequestId } = req.params;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });
        const ride = await prisma.rideRequest.findUnique({
            where: { id: rideId },
            select: {
                id: true,
                riderId: true,
                driverId: true,
                totalAmount: true,
                negotiatedFare: true,
                negotiationStatus: true,
                negotiationRounds: true,
                negotiationMaxPercent: true,
                negotiationExpiresAt: true,
            },
        });

        if (!ride) return res.status(404).json({ success: false, message: "Ride request not found" });

        const userId = req.user.id;
        const isAdmin = req.user.userType === "admin";
        if (!isAdmin && ride.riderId !== userId && ride.driverId !== userId) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }

        const history = await prisma.rideNegotiation.findMany({
            where: { rideRequestId: ride.id },
            orderBy: { createdAt: "asc" },
        });

        res.json({
            success: true,
            data: {
                ride: {
                    id: ride.id,
                    baseFare: ride.totalAmount,
                    negotiatedFare: ride.negotiatedFare,
                    negotiationStatus: ride.negotiationStatus,
                    negotiationRounds: ride.negotiationRounds,
                    maxPercent: ride.negotiationMaxPercent,
                    expiresAt: ride.negotiationExpiresAt,
                },
                history,
            },
        });
    } catch (error) {
        console.error("Get negotiation history error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
