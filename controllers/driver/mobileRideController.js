import prisma from "../../utils/prisma.js";
import { parseRideRequestIdParam, pickRideRequestIdFromBody } from "../../utils/rideRequestId.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/serverResponse.js";
import { getDriverAndSystemShare } from "../../utils/settingsHelper.js";
import { calculateTripPrice } from "../../utils/pricingCalculator.js";
import { getDriverSearchRadius, getDriverRejectionCooldownDuration } from "../../utils/settingsHelper.js";
import { getNegotiationSettings, validateFareBounds, computeExpiresAt } from "../../utils/negotiationHelper.js";

/**
 * Check if driver is currently blocked from rejecting rides
 * Returns { isBlocked: boolean, remainingMinutes: number }
 */
async function checkDriverRejectionBlock(driverId) {
    const driver = await prisma.user.findUnique({
        where: { id: driverId },
        select: { lastRejectionAt: true }
    });

    if (!driver?.lastRejectionAt) {
        return { isBlocked: false, remainingMinutes: 0 };
    }

    const cooldownHours = await getDriverRejectionCooldownDuration();
    const cooldownMs = cooldownHours * 60 * 60 * 1000; // Convert hours to milliseconds
    const timeSinceLastRejection = Date.now() - new Date(driver.lastRejectionAt).getTime();

    if (timeSinceLastRejection < cooldownMs) {
        const remainingMs = cooldownMs - timeSinceLastRejection;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        return { isBlocked: true, remainingMinutes };
    }

    return { isBlocked: false, remainingMinutes: 0 };
}

// Driver's ride history with pagination and filters
export const getMyRides = asyncHandler(async (req, res) => {
    const {
        status,
        page = 1,
        per_page = 15,
        sortBy = "createdAt",
        sortOrder = "desc",
        fromDate,
        toDate,
    } = req.query;

    const where = { driverId: req.user.id };
    if (status && status !== "all") where.status = status;
    if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) {
            const d = new Date(toDate);
            d.setHours(23, 59, 59, 999);
            where.createdAt.lte = d;
        }
    }

    const skip = (parseInt(page) - 1) * parseInt(per_page);
    const [rides, total] = await Promise.all([
        prisma.rideRequest.findMany({
            where,
            include: {
                rider: { select: { id: true, firstName: true, lastName: true, contactNumber: true, avatar: true } },
                service: { select: { id: true, name: true, nameAr: true } },
            },
            skip,
            take: parseInt(per_page),
            orderBy: { [sortBy]: sortOrder === "asc" ? "asc" : "desc" },
        }),
        prisma.rideRequest.count({ where }),
    ]);

    return res.json({
        success: true,
        data: rides,
        pagination: { total, page: parseInt(page), per_page: parseInt(per_page), total_pages: Math.ceil(total / parseInt(per_page)) },
    });
});

// Single ride detail
export const getRideDetail = asyncHandler(async (req, res) => {
    const rideId = parseRideRequestIdParam(req.params.id);
    if (!rideId) return errorResponse(res, "Invalid ride id", 400);
    const ride = await prisma.rideRequest.findUnique({
        where: { id: rideId },
        include: {
            rider: { select: { id: true, firstName: true, lastName: true, contactNumber: true, avatar: true } },
            service: { select: { id: true, name: true, nameAr: true } },
            payments: { select: { id: true, paymentStatus: true, paymentType: true, amount: true }, take: 1, orderBy: { createdAt: "desc" } },
            ratings: true,
            negotiations: { orderBy: { createdAt: "desc" } },
        },
    });
    if (!ride) return errorResponse(res, "Ride not found", 404);
    if (ride.driverId !== req.user.id) return errorResponse(res, "Not authorized", 403);
    return successResponse(res, ride);
});

// Accept or reject incoming ride request with optional price negotiation
export const respondToRide = asyncHandler(async (req, res) => {
    const { rideRequestId, accept, proposedFare, rejectReason } = req.body;
    if (!rideRequestId) return errorResponse(res, "rideRequestId is required", 400);
    const rideId = parseRideRequestIdParam(rideRequestId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId", 400);

    const ride = await prisma.rideRequest.findUnique({
        where: { id: rideId },
        include: { rider: { select: { id: true, firstName: true, lastName: true } } }
    });
    if (!ride) return errorResponse(res, "Ride request not found", 404);

    if (accept) {
        // Check if driver proposed a different fare (negotiation)
        if (proposedFare && parseFloat(proposedFare) !== parseFloat(ride.totalAmount)) {
            const parsedFare = parseFloat(proposedFare);
            if (!Number.isFinite(parsedFare) || parsedFare <= 0) {
                return errorResponse(res, "Invalid proposedFare", 400);
            }

            const settings = await getNegotiationSettings();
            if (!settings.enabled) {
                return errorResponse(res, "Negotiation is disabled", 403);
            }

            const { valid, percentChange, message } = validateFareBounds(
                parseFloat(ride.totalAmount),
                parsedFare,
                settings.maxPercent
            );
            if (!valid) return errorResponse(res, message, 400);

            const expiresAt = computeExpiresAt(settings.timeoutSeconds);

            await prisma.$transaction([
                prisma.rideNegotiation.create({
                    data: {
                        rideRequestId: ride.id,
                        proposedBy: "driver",
                        proposedFare: parsedFare,
                        percentChange,
                        action: "counter",
                        round: (ride.negotiationRounds || 0) + 1,
                    },
                }),
                prisma.rideRequest.update({
                    where: { id: ride.id },
                    data: {
                        driverId: req.user.id,
                        status: "negotiating",
                        negotiatedFare: parsedFare,
                        negotiationStatus: "pending",
                        lastNegotiationBy: "driver",
                        negotiationRounds: (ride.negotiationRounds || 0) + 1,
                        negotiationMaxPercent: settings.maxPercent,
                        negotiationExpiresAt: expiresAt,
                    },
                }),
            ]);

            // Notify rider about the counter offer
            try {
                const { emitToUser } = await import("../../utils/socketService.js");
                const io = req.app.get("io") || global.io;
                if (io) emitToUser(io, ride.riderId, "ride-negotiation-offer", {
                    rideRequestId: ride.id,
                    driverId: req.user.id,
                    proposedFare: parsedFare,
                    originalFare: ride.totalAmount,
                    expiresAt,
                });
            } catch (_) {}

            return successResponse(res, {
                rideRequestId: ride.id,
                status: "negotiating",
                proposedFare: parsedFare
            }, "Counter offer sent to rider");
        } else {
            // Direct acceptance without negotiation
            await prisma.rideRequest.update({
                where: { id: ride.id },
                data: { driverId: req.user.id, status: "accepted" },
            });

            try {
                const { emitToRide } = await import("../../utils/socketService.js");
                const io = req.app.get("io") || global.io;
                if (io) emitToRide(io, ride.id, "ride-request-accepted", { driverId: req.user.id, rideRequestId: ride.id });
            } catch (_) {}

            return successResponse(res, {
                rideRequestId: ride.id,
                status: "accepted"
            }, "Ride accepted successfully");
        }
    } else {
        // Reject the ride
        // Check if driver is currently blocked from rejecting
        const blockStatus = await checkDriverRejectionBlock(req.user.id);
        if (blockStatus.isBlocked) {
            return errorResponse(res, `You are blocked from rejecting rides. Try again in ${blockStatus.remainingMinutes} minutes.`, 429);
        }

        const cancelledIds = ride.cancelledDriverIds ? JSON.parse(ride.cancelledDriverIds) : [];
        cancelledIds.push(req.user.id);

        // Update rejection tracking
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                lastRejectionAt: new Date(),
                driverRejectionCount: {
                    increment: 1
                }
            }
        });

        await prisma.rideRequest.update({
            where: { id: ride.id },
            data: {
                cancelledDriverIds: JSON.stringify(cancelledIds),
                driverNote: rejectReason || null
            },
        });

        // Notify rider about rejection
        try {
            const { emitToUser } = await import("../../utils/socketService.js");
            const io = req.app.get("io") || global.io;
            if (io) emitToUser(io, ride.riderId, "ride-negotiation-rejected", {
                rideRequestId: ride.id,
                driverId: req.user.id,
                reason: rejectReason
            });
        } catch (_) {}

        return successResponse(res, {
            rideRequestId: ride.id,
            status: "rejected",
            reason: rejectReason
        }, "Ride rejected");
    }
});

// Get available ride requests for driver
export const getAvailableRides = asyncHandler(async (req, res) => {
    const driverId = req.user.id;
    const { latitude, longitude } = req.query;

    // Validate required parameters
    if (!latitude || !longitude) {
        return errorResponse(res, "Driver latitude and longitude are required", 400);
    }

    // Check if driver is blocked from rejecting (and thus cannot see new rides)
    const blockStatus = await checkDriverRejectionBlock(driverId);
    if (blockStatus.isBlocked) {
        return successResponse(res, {
            availableRides: [],
            isDriverBlocked: true,
            blockMessage: `You are blocked from viewing new rides. Try again in ${blockStatus.remainingMinutes} minutes.`,
            remainingMinutes: blockStatus.remainingMinutes
        });
    }

    const driverLat = parseFloat(latitude);
    const driverLng = parseFloat(longitude);
    const searchRadius = await getDriverSearchRadius();
    const now = new Date();
    const scheduleOpenAt = new Date(now.getTime() + 30 * 60 * 1000); // show scheduled rides in next 30 min

    // Get pending ride requests
    const pendingRides = await prisma.rideRequest.findMany({
        where: {
            driverId: null, // Not yet assigned to any driver
            startLatitude: { not: null },
            startLongitude: { not: null },
            // Defensive guard: if a payment record exists, this ride should not be offered again.
            payments: { none: {} },
            OR: [
                // Normal/immediate bookings
                { status: "pending", isSchedule: false },
                // Backward-compat: scheduled but still pending
                { status: "pending", isSchedule: true, scheduleDatetime: { lte: scheduleOpenAt } },
                // Special/scheduled bookings in scheduled state
                { status: "scheduled", isSchedule: true, scheduleDatetime: { lte: scheduleOpenAt } },
            ],
        },
        include: {
            rider: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    contactNumber: true,
                    avatar: true
                }
            },
            service: {
                include: {
                    vehicleCategory: {
                        select: {
                            id: true,
                            name: true,
                            nameAr: true,
                            capacity: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: "desc"
        },
        take: 50 // Limit results to prevent overload
    });

    // Get rider ratings
    const riderIds = [...new Set(pendingRides.map(ride => ride.riderId))];
    const riderRatings = await prisma.rideRequestRating.groupBy({
        by: ['riderId'],
        where: {
            riderId: { in: riderIds },
            ratingBy: 'driver' // Ratings given by drivers to riders
        },
        _avg: {
            rating: true
        }
    });

    // Create a map of riderId to average rating
    const ratingMap = new Map();
    riderRatings.forEach(rating => {
        ratingMap.set(rating.riderId, Math.round(rating._avg.rating * 10) / 10); // Round to 1 decimal
    });

    // Filter rides by distance and exclude previously rejected ones
    const availableRides = pendingRides
        .map(ride => {
            const pickupLat = parseFloat(ride.startLatitude);
            const pickupLng = parseFloat(ride.startLongitude);

            // Calculate distance using Haversine formula
            const distance = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);

            // Check if driver previously rejected this ride
            const cancelledDriverIds = ride.cancelledDriverIds ? JSON.parse(ride.cancelledDriverIds) : [];
            const wasRejected = cancelledDriverIds.includes(driverId);

            return {
                ...ride,
                distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
                wasRejected
            };
        })
        .filter(ride => ride.distance <= searchRadius && !ride.wasRejected)
        .sort((a, b) => a.distance - b.distance) // Sort by distance (closest first)
        .slice(0, 20); // Return top 20 closest rides

    // Format response data
    const formattedRides = await Promise.all(availableRides.map(async (ride) => {
        // Calculate estimated price
        const estimatedPrice = await calculateEstimatedPrice(ride);

        return {
            id: ride.id,
            rider: {
                id: ride.rider.id,
                name: `${ride.rider.firstName || ''} ${ride.rider.lastName || ''}`.trim(),
                avatar: ride.rider.avatar,
                phone: ride.rider.contactNumber,
                rating: ratingMap.get(ride.rider.id) || 0
            },
            pickup: {
                latitude: ride.startLatitude,
                longitude: ride.startLongitude,
                address: ride.startAddress
            },
            dropoff: {
                latitude: ride.endLatitude,
                longitude: ride.endLongitude,
                address: ride.endAddress
            },
            service: ride.service ? {
                id: ride.service.id,
                name: ride.service.name,
                nameAr: ride.service.nameAr
            } : null,
            vehicleCategory: ride.service?.vehicleCategory ? {
                id: ride.service.vehicleCategory.id,
                name: ride.service.vehicleCategory.name,
                nameAr: ride.service.vehicleCategory.nameAr,
                capacity: ride.service.vehicleCategory.capacity
            } : null,
            pricing: {
                totalAmount: ride.totalAmount,
                estimatedPrice: estimatedPrice,
                baseFare: ride.baseFare,
                distance: ride.distance,
                duration: ride.duration,
                paymentType: ride.paymentType
            },
            distance: ride.distance, // Distance from driver to pickup
            createdAt: ride.createdAt,
            isScheduled: ride.isSchedule,
            scheduledTime: ride.scheduleDatetime
        };
    }));

    return successResponse(res, {
        rides: formattedRides,
        total: formattedRides.length,
        searchRadius,
        driverLocation: { latitude: driverLat, longitude: driverLng }
    });
});

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Calculate estimated price for a ride
const calculateEstimatedPrice = async (ride) => {
    try {
        if (!ride.startLatitude || !ride.startLongitude || !ride.endLatitude || !ride.endLongitude) {
            return null;
        }

        // Calculate distance between pickup and dropoff
        const distance = calculateDistance(
            parseFloat(ride.startLatitude),
            parseFloat(ride.startLongitude),
            parseFloat(ride.endLatitude),
            parseFloat(ride.endLongitude)
        );

        // Get vehicle category ID
        const vehicleCategoryId = ride.service?.vehicleCategory?.id || ride.vehicleCategoryId;

        if (!vehicleCategoryId) {
            return null;
        }

        // Calculate price using pricing rules
        const priceResult = await calculateTripPrice(
            vehicleCategoryId,
            distance,
            ride.duration || 0, // Use duration if available
            0 // No waiting time for estimation
        );

        if (priceResult.success) {
            return {
                estimatedTotal: priceResult.totalAmount,
                breakdown: priceResult.breakdown,
                currency: priceResult.currency
            };
        }

        return null;
    } catch (error) {
        console.error('Error calculating estimated price:', error);
        return null;
    }
};

// Update ride status (arrived, started)
export const updateRideStatus = asyncHandler(async (req, res) => {
    const rawId = pickRideRequestIdFromBody(req.body);
    const { status } = req.body || {};
    const allowed = ["arrived", "started"];
    if (!allowed.includes(status)) return errorResponse(res, `status must be one of: ${allowed.join(", ")}`, 400);

    const rideId = parseRideRequestIdParam(rawId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId (use numeric id or booking_id)", 400);
    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) return errorResponse(res, "Ride not found", 404);
    if (ride.driverId !== req.user.id) return errorResponse(res, "Not authorized", 403);

    const updated = await prisma.rideRequest.update({ where: { id: ride.id }, data: { status } });

    try {
        const { emitToRide } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) emitToRide(io, ride.id, `ride-${status}`, { rideRequestId: ride.id, driverId: req.user.id, status });
    } catch (_) {}

    return successResponse(res, updated, `Ride status updated to ${status}`);
});

// Complete ride (driver ends trip)
export const completeRide = asyncHandler(async (req, res) => {
    const rawId = pickRideRequestIdFromBody(req.body);
    const { tips } = req.body || {};
    const rideId = parseRideRequestIdParam(rawId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId (use numeric id or booking_id)", 400);

    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) return errorResponse(res, "Ride not found", 404);
    if (ride.driverId !== req.user.id) return errorResponse(res, "Not authorized", 403);

    const effectiveFare =
        ride.negotiationStatus === "accepted" && ride.negotiatedFare != null
            ? parseFloat(ride.negotiatedFare)
            : parseFloat(ride.totalAmount);
    const totalAmount = effectiveFare + (parseFloat(tips) || 0);

    await prisma.rideRequest.update({ where: { id: ride.id }, data: { status: "completed", tips: tips || 0, totalAmount } });

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
                description: ride.negotiationStatus === "accepted" ? "Ride earnings (cash) — negotiated fare" : "Ride earnings (cash)",
                transactionType: "ride_earnings",
                rideRequestId: ride.id,
            },
        });
    }

    try {
        const { emitToRide } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) emitToRide(io, ride.id, "trip-completed", { rideRequestId: ride.id, driverId: req.user.id, totalAmount });
    } catch (_) {}

    const updated = await prisma.rideRequest.findUnique({ where: { id: ride.id } });
    return successResponse(res, updated, "Ride completed successfully");
});

// Cancel ride from driver side
export const cancelRide = asyncHandler(async (req, res) => {
    const rawId = pickRideRequestIdFromBody(req.body);
    const { reason } = req.body || {};
    if (rawId == null || rawId === "") {
        return errorResponse(res, "rideRequestId is required (or booking_id / bookingId)", 400);
    }
    const rideId = parseRideRequestIdParam(rawId);
    if (!rideId) {
        return errorResponse(
            res,
            "Invalid ride id: use the numeric id from GET /apimobile/driver/rides or ride details (integers only, not UUID strings).",
            400
        );
    }

    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) return errorResponse(res, "Ride not found", 404);
    if (ride.driverId !== req.user.id) {
        return errorResponse(res, "This ride is not assigned to your driver account", 403);
    }

    // Check if ride can be cancelled
    if (ride.status === "completed") {
        return errorResponse(res, "Cannot cancel a completed ride", 400);
    }

    if (ride.status === "cancelled") {
        return errorResponse(res, "Ride is already cancelled", 400);
    }

    await prisma.rideRequest.update({
        where: { id: ride.id },
        data: { status: "cancelled", cancelBy: "driver", reason: reason || null, driverId: null },
    });

    try {
        const { emitToRide } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) emitToRide(io, ride.id, "trip-cancelled", { rideRequestId: ride.id, cancelBy: "driver", reason });
    } catch (_) {}

    return successResponse(res, null, "Ride cancelled");
});

// Rate the rider after a completed ride
export const rateRider = asyncHandler(async (req, res) => {
    const { rideRequestId, rating, comment } = req.body;
    if (!rideRequestId || !rating) return errorResponse(res, "rideRequestId and rating are required", 400);
    const rideId = parseRideRequestIdParam(rideRequestId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId", 400);

    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) return errorResponse(res, "Ride not found", 404);
    if (ride.driverId !== req.user.id) return errorResponse(res, "Not authorized", 403);

    await prisma.rideRequestRating.create({
        data: { rideRequestId: ride.id, riderId: ride.riderId, driverId: ride.driverId, rating: parseFloat(rating), comment, ratingBy: "driver" },
    });
    await prisma.rideRequest.update({ where: { id: ride.id }, data: { isDriverRated: true } });

    return successResponse(res, null, "Rating saved");
});

// Get ratings received by this driver
export const getMyRatings = asyncHandler(async (req, res) => {
    const { page = 1, per_page = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(per_page);

    const where = { driverId: req.user.id, ratingBy: "rider" };
    const [ratings, total] = await Promise.all([
        prisma.rideRequestRating.findMany({
            where,
            include: {
                rider: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                rideRequest: { select: { id: true, startAddress: true, endAddress: true, createdAt: true } },
            },
            skip,
            take: parseInt(per_page),
            orderBy: { createdAt: "desc" },
        }),
        prisma.rideRequestRating.count({ where }),
    ]);

    const avgResult = await prisma.rideRequestRating.aggregate({ where, _avg: { rating: true }, _count: true });

    return res.json({
        success: true,
        data: ratings,
        summary: {
            averageRating: Math.round((avgResult._avg.rating || 0) * 100) / 100,
            totalRatings: avgResult._count,
        },
        pagination: { total, page: parseInt(page), per_page: parseInt(per_page), total_pages: Math.ceil(total / parseInt(per_page)) },
    });
});

// Earnings summary
export const getEarningsSummary = asyncHandler(async (req, res) => {
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
    if (!wallet) return successResponse(res, { balance: 0, totalEarnings: 0, totalWithdrawn: 0, pendingWithdrawals: 0, todayEarnings: 0 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalEarnings, totalWithdrawn, pendingWithdrawals, todayEarnings, thisWeekEarnings, thisMonthEarnings] = await Promise.all([
        prisma.walletHistory.aggregate({ where: { walletId: wallet.id, type: "credit", transactionType: "ride_earnings" }, _sum: { amount: true } }),
        prisma.walletHistory.aggregate({ where: { walletId: wallet.id, type: "debit", transactionType: "withdrawal" }, _sum: { amount: true } }),
        prisma.withdrawRequest.aggregate({ where: { userId: req.user.id, status: 0 }, _sum: { amount: true }, _count: true }),
        prisma.walletHistory.aggregate({ where: { walletId: wallet.id, type: "credit", transactionType: "ride_earnings", createdAt: { gte: today, lt: tomorrow } }, _sum: { amount: true } }),
        prisma.walletHistory.aggregate({ where: { walletId: wallet.id, type: "credit", transactionType: "ride_earnings", createdAt: { gte: new Date(today.getTime() - 7 * 86400000) } }, _sum: { amount: true } }),
        prisma.walletHistory.aggregate({ where: { walletId: wallet.id, type: "credit", transactionType: "ride_earnings", createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) } }, _sum: { amount: true } }),
    ]);

    const completedRides = await prisma.rideRequest.count({ where: { driverId: req.user.id, status: "completed" } });
    const todayRides = await prisma.rideRequest.count({ where: { driverId: req.user.id, status: "completed", createdAt: { gte: today, lt: tomorrow } } });

    return successResponse(res, {
        balance: parseFloat(wallet.balance) || 0,
        currency: wallet.currency || "USD",
        totalEarnings: totalEarnings._sum.amount || 0,
        totalWithdrawn: totalWithdrawn._sum.amount || 0,
        pendingWithdrawals: pendingWithdrawals._sum.amount || 0,
        pendingWithdrawalCount: pendingWithdrawals._count || 0,
        todayEarnings: todayEarnings._sum.amount || 0,
        thisWeekEarnings: thisWeekEarnings._sum.amount || 0,
        thisMonthEarnings: thisMonthEarnings._sum.amount || 0,
        completedRides,
        todayRides,
    });
});

// Apply bid on a ride
export const applyBid = asyncHandler(async (req, res) => {
    const { rideRequestId, bidAmount } = req.body;
    if (!rideRequestId || bidAmount == null) return errorResponse(res, "rideRequestId and bidAmount are required", 400);
    const rideId = parseRideRequestIdParam(rideRequestId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId", 400);

    const ride = await prisma.rideRequest.findUnique({ where: { id: rideId } });
    if (!ride) return errorResponse(res, "Ride not found", 404);

    await prisma.rideRequestBid.create({ data: { rideRequestId: ride.id, driverId: req.user.id, bidAmount: parseFloat(bidAmount) } });
    await prisma.rideRequest.update({ where: { id: ride.id }, data: { rideHasBid: true } });

    return successResponse(res, null, "Bid applied successfully");
});

// Update driver location during a ride
export const updateLocation = asyncHandler(async (req, res) => {
    const { latitude, longitude, currentHeading } = req.body;
    if (!latitude || !longitude) return errorResponse(res, "latitude and longitude are required", 400);

    await prisma.user.update({
        where: { id: req.user.id },
        data: {
            latitude: String(latitude),
            longitude: String(longitude),
            currentHeading: currentHeading ? parseFloat(currentHeading) : undefined,
            lastLocationUpdateAt: new Date(),
        },
    });

    try {
        const { emitDriverLocationUpdate, emitToRide } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) {
            emitDriverLocationUpdate(io, req.user.id, {
                latitude,
                longitude,
                currentHeading,
                heading: currentHeading,
            });
            const activeRides = await prisma.rideRequest.findMany({
                where: {
                    driverId: req.user.id,
                    status: { in: ["accepted", "arrived", "started"] },
                },
                select: { id: true },
            });
            const payload = {
                driverId: req.user.id,
                latitude: String(latitude),
                longitude: String(longitude),
                heading: currentHeading != null ? parseFloat(currentHeading) : null,
            };
            for (const r of activeRides) {
                emitToRide(io, r.id, "driver-location-for-ride", { ...payload, rideRequestId: r.id });
            }
        }
    } catch (_) {}

    return successResponse(res, { latitude, longitude }, "Location updated");
});
