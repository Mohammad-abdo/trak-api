import prisma from "../../utils/prisma.js";
import { parseRideRequestIdParam, pickRideRequestIdFromBody } from "../../utils/rideRequestId.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/serverResponse.js";
import {
    getDriverAndSystemShare,
    getDriverSearchRadius,
    getDriverRejectionSettings,
    getRegularRideFindDriverTimeoutMinutes,
} from "../../utils/settingsHelper.js";
import { calculateTripPrice } from "../../utils/pricingCalculator.js";
import { getNegotiationSettings, validateFareBounds, computeExpiresAt } from "../../utils/negotiationHelper.js";
import { emitDriverTripSyncFromReq } from "../../utils/driverTripSocketSync.js";
import { replayPendingRidesForDriver } from "../../utils/replayPendingRidesForDriver.js";

/**
 * Check if driver is currently blocked from rejecting/viewing rides.
 *
 * Logic:
 *  1. If the feature is disabled by admin → never blocked.
 *  2. A block starts when driverRejectionCount >= maxCount.
 *  3. The block lasts for `cooldownHours` starting from `lastRejectionAt`
 *     (the timestamp of the rejection that crossed the limit).
 *  4. Once the block expires the count is automatically reset to 0.
 *
 * Returns { isBlocked, remainingMinutes, rejectionCount, maxCount, cooldownHours, enabled }
 */
async function checkDriverRejectionBlock(driverId) {
    const { enabled, maxCount, cooldownHours } = await getDriverRejectionSettings();

    // Feature off → drivers can reject freely
    if (!enabled) {
        return { isBlocked: false, remainingMinutes: 0, enabled: false, maxCount, cooldownHours };
    }

    const driver = await prisma.user.findUnique({
        where: { id: driverId },
        select: { lastRejectionAt: true, driverRejectionCount: true },
    });

    const rejectionCount = driver?.driverRejectionCount ?? 0;

    // Not yet at the limit → no block
    if (rejectionCount < maxCount) {
        return { isBlocked: false, remainingMinutes: 0, enabled, rejectionCount, maxCount, cooldownHours };
    }

    // Count is at/over limit — check whether the block window is still active
    const lastRejectionAt = driver?.lastRejectionAt;
    if (!lastRejectionAt) {
        // Inconsistent state — reset and allow
        await prisma.user.update({ where: { id: driverId }, data: { driverRejectionCount: 0 } });
        return { isBlocked: false, remainingMinutes: 0, enabled, rejectionCount: 0, maxCount, cooldownHours };
    }

    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    const elapsed = Date.now() - new Date(lastRejectionAt).getTime();

    if (elapsed < cooldownMs) {
        const remainingMs = cooldownMs - elapsed;
        const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
        return { isBlocked: true, remainingMinutes, enabled, rejectionCount, maxCount, cooldownHours };
    }

    // Block window has expired → auto-reset the counter
    await prisma.user.update({ where: { id: driverId }, data: { driverRejectionCount: 0 } });
    return { isBlocked: false, remainingMinutes: 0, enabled, rejectionCount: 0, maxCount, cooldownHours };
}

/**
 * Auto-remove expired regular rides that were never accepted by any driver.
 * This enforces: if no driver accepts in X minutes, ride is deleted permanently.
 * Returns number of deleted rides.
 */
async function purgeExpiredUnacceptedRegularRides() {
    const timeoutMinutes = await getRegularRideFindDriverTimeoutMinutes();
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // "Unaccepted" here means still pending/negotiating (not accepted/started/completed)
    // and no payment record.
    const expiredRides = await prisma.rideRequest.findMany({
        where: {
            isSchedule: false,
            createdAt: { lte: cutoff },
            status: { in: ["pending", "negotiating"] },
            payments: { none: {} },
        },
        select: { id: true },
        take: 300,
    });

    const rideIds = expiredRides.map((r) => r.id);
    if (rideIds.length === 0) return 0;

    // Complaints may have child comments; delete comments first.
    const complaints = await prisma.complaint.findMany({
        where: { rideRequestId: { in: rideIds } },
        select: { id: true },
    });
    const complaintIds = complaints.map((c) => c.id);

    await prisma.$transaction([
        ...(complaintIds.length > 0
            ? [prisma.complaintComment.deleteMany({ where: { complaintId: { in: complaintIds } } })]
            : []),
        prisma.complaint.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.rideNegotiation.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.rideRequestBid.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.rideRequestRating.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.rideRequestHistory.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.walletHistory.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.payment.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.rideChatMessage.deleteMany({ where: { rideRequestId: { in: rideIds } } }),
        prisma.rideRequest.deleteMany({ where: { id: { in: rideIds } } }),
    ]);

    return rideIds.length;
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

    // Guard: another driver may have already claimed this ride
    if (ride.driverId && ride.driverId !== req.user.id) {
        return errorResponse(res, "This ride has already been taken by another driver", 409);
    }

    // Guard: ride must still be actionable
    if (!["pending", "scheduled", "negotiating"].includes(ride.status)) {
        return errorResponse(res, `Cannot respond to a ride with status '${ride.status}'`, 400);
    }

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

            // Notify rider: counter offer + unified "driver offer" event for polling fallback
            try {
                const { emitToUser } = await import("../../utils/socketService.js");
                const io = req.app.get("io") || global.io;
                if (io) {
                    const offerPayload = {
                        rideRequestId: ride.id,
                        driverId: req.user.id,
                        proposedFare: parsedFare,
                        originalFare: ride.totalAmount,
                        expiresAt,
                        offerType: 'negotiation',
                    };
                    emitToUser(io, ride.riderId, "ride-negotiation-offer", offerPayload);
                    // Unified event — rider app listens to this to trigger near-drivers refresh
                    emitToUser(io, ride.riderId, "driver-offer-received", offerPayload);
                }
            } catch (_) {}

            emitDriverTripSyncFromReq(req, ride.id, "respond_negotiation");

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
                const { emitToRide, emitToUser } = await import("../../utils/socketService.js");
                const io = req.app.get("io") || global.io;
                if (io) {
                    emitToRide(io, ride.id, "ride-request-accepted", { driverId: req.user.id, rideRequestId: ride.id });
                    // Unified event — rider app triggers near-drivers refresh on this
                    emitToUser(io, ride.riderId, "driver-offer-received", {
                        rideRequestId: ride.id,
                        driverId: req.user.id,
                        proposedFare: parseFloat(ride.totalAmount),
                        originalFare: parseFloat(ride.totalAmount),
                        offerType: 'direct_accept',
                    });
                }
            } catch (_) {}

            emitDriverTripSyncFromReq(req, ride.id, "respond_direct_accept");

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
            return errorResponse(
                res,
                `You are blocked from rejecting rides for ${blockStatus.remainingMinutes} more minute(s) ` +
                `because you rejected ${blockStatus.maxCount} ride(s) in a row. ` +
                `The block lasts ${blockStatus.cooldownHours} hour(s).`,
                429
            );
        }

        const cancelledIds = ride.cancelledDriverIds ? JSON.parse(ride.cancelledDriverIds) : [];
        cancelledIds.push(req.user.id);

        // Read the driver's current rejection count BEFORE incrementing
        const driverRow = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { driverRejectionCount: true },
        });
        const currentCount = driverRow?.driverRejectionCount ?? 0;
        const newCount = currentCount + 1;
        const { enabled, maxCount } = blockStatus;

        // Only update lastRejectionAt (block start) when the count actually hits the limit.
        // This means the block window starts from the moment the driver crosses the threshold,
        // not from every individual rejection.
        const updateData = {
            driverRejectionCount: newCount,
            ...(enabled && newCount >= maxCount ? { lastRejectionAt: new Date() } : {}),
        };

        await prisma.user.update({ where: { id: req.user.id }, data: updateData });

        await prisma.rideRequest.update({
            where: { id: ride.id },
            data: {
                cancelledDriverIds: JSON.stringify(cancelledIds),
                driverNote: rejectReason || null,
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

        emitDriverTripSyncFromReq(req, ride.id, "respond_reject", req.user.id);

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

    // Auto-clean expired unaccepted regular rides before serving availability.
    await purgeExpiredUnacceptedRegularRides();

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
        const estimatedPrice = await calculateEstimatedPrice(ride);

        // Real system-calculated price (km × service rate). Falls back to stored amount.
        const realPrice = estimatedPrice?.estimatedTotal ?? parseFloat(ride.totalAmount);

        // userRequestedPrice: what the user said they want to pay.
        // Stored in pricingData during booking creation when the user passes `requestedPrice`.
        // Falls back to the system price when the user did not specify a custom price.
        const storedPricing = ride.pricingData
            ? (typeof ride.pricingData === 'string' ? JSON.parse(ride.pricingData) : ride.pricingData)
            : null;
        const userRequestedPrice = storedPricing?.userRequestedPrice ?? parseFloat(ride.totalAmount);

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
                realPrice,             // fresh km × service-rate calculation (authoritative)
                userRequestedPrice,    // what the user wants to pay (may differ when requestedPrice was sent)
                isNegotiable: userRequestedPrice < realPrice, // quick flag for driver UX
                breakdown: estimatedPrice?.breakdown ?? null,
                currency: storedPricing?.currency ?? estimatedPrice?.currency ?? "SAR",
                baseFare: ride.baseFare,
                tripDistanceKm: estimatedPrice?.breakdown?.distance ?? storedPricing?.distanceKm ?? null,
                perKmRate: estimatedPrice?.breakdown?.perKmRate ?? null,
                duration: ride.duration,
                paymentType: ride.paymentType
            },
            distance: ride.distance,
            createdAt: ride.createdAt,
            isScheduled: ride.isSchedule,
            scheduledTime: ride.scheduleDatetime
        };
    }));

    const responseBody = {
        rides: formattedRides,
        total: formattedRides.length,
        searchRadius,
        driverLocation: { latitude: driverLat, longitude: driverLng },
    };

    try {
        const io = req.app.get("io") || global.io;
        if (io) {
            setImmediate(() => {
                replayPendingRidesForDriver(io, driverId, driverLat, driverLng).catch(() => {});
            });
        }
    } catch (_) {}

    return successResponse(res, responseBody);
});

/**
 * GET /apimobile/driver/rides/available/poll?latitude=...&longitude=...
 *
 * Ultra-lightweight polling endpoint.
 * Returns only { count, rideIds[] } instead of full ride objects so mobile apps
 * can poll every 5 s cheaply and only fetch full details when `count > 0`.
 *
 * Shares the same purge + distance logic as getAvailableRides but skips
 * ratings, price estimation, and response formatting.
 */
export const pollAvailableRides = asyncHandler(async (req, res) => {
    const driverId = req.user.id;
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
        return errorResponse(res, "latitude and longitude are required", 400);
    }

    const blockStatus = await checkDriverRejectionBlock(driverId);
    if (blockStatus.isBlocked) {
        return res.json({ success: true, data: { count: 0, rideIds: [], isBlocked: true, remainingMinutes: blockStatus.remainingMinutes } });
    }

    await purgeExpiredUnacceptedRegularRides();

    const driverLat = parseFloat(latitude);
    const driverLng = parseFloat(longitude);
    const searchRadius = await getDriverSearchRadius();
    const now = new Date();
    const scheduleOpenAt = new Date(now.getTime() + 30 * 60 * 1000);

    const pendingRides = await prisma.rideRequest.findMany({
        where: {
            driverId: null,
            startLatitude: { not: null },
            startLongitude: { not: null },
            payments: { none: {} },
            OR: [
                { status: "pending", isSchedule: false },
                { status: "pending", isSchedule: true, scheduleDatetime: { lte: scheduleOpenAt } },
                { status: "scheduled", isSchedule: true, scheduleDatetime: { lte: scheduleOpenAt } },
            ],
        },
        select: { id: true, startLatitude: true, startLongitude: true, cancelledDriverIds: true },
        take: 100,
    });

    const nearby = pendingRides.filter((r) => {
        const cancelledIds = r.cancelledDriverIds ? JSON.parse(r.cancelledDriverIds) : [];
        if (cancelledIds.includes(driverId)) return false;
        const dist = calculateDistance(driverLat, driverLng, parseFloat(r.startLatitude), parseFloat(r.startLongitude));
        return dist <= searchRadius;
    });

    try {
        const io = req.app.get("io") || global.io;
        if (io) {
            setImmediate(() => {
                replayPendingRidesForDriver(io, driverId, driverLat, driverLng).catch(() => {});
            });
        }
    } catch (_) {}

    return res.json({
        success: true,
        data: {
            count: nearby.length,
            rideIds: nearby.map((r) => r.id),
            isBlocked: false,
        },
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

    emitDriverTripSyncFromReq(req, ride.id, `ride_status_${status}`);

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

    emitDriverTripSyncFromReq(req, ride.id, "ride_completed");

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

    emitDriverTripSyncFromReq(req, ride.id, "ride_cancelled_driver");

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

// ─── Driver Proposes a Negotiation Price to the Rider ────────────────────────
// POST /negotiation/propose
// Driver sends ONE price offer on an unassigned ride. Rider must accept/reject.
export const driverProposeNegotiation = asyncHandler(async (req, res) => {
    const { rideRequestId, proposedFare } = req.body;
    if (!rideRequestId || proposedFare == null) {
        return errorResponse(res, "rideRequestId and proposedFare are required", 400);
    }
    const rideId = parseRideRequestIdParam(rideRequestId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId", 400);

    const parsedFare = parseFloat(proposedFare);
    if (!Number.isFinite(parsedFare) || parsedFare <= 0) {
        return errorResponse(res, "proposedFare must be a positive number", 400);
    }

    const ride = await prisma.rideRequest.findUnique({
        where: { id: rideId },
        include: {
            service: { include: { vehicleCategory: true } }
        }
    });
    if (!ride) return errorResponse(res, "Ride request not found", 404);

    if (ride.driverId && ride.driverId !== req.user.id) {
        return errorResponse(res, "This ride is already taken by another driver", 409);
    }
    if (!["pending", "scheduled"].includes(ride.status)) {
        return errorResponse(res, `Cannot negotiate on a ride with status '${ride.status}'`, 400);
    }

    // Calculate the real system price (km × service rate) to anchor the negotiation
    let realPrice = parseFloat(ride.totalAmount);
    let priceBreakdown = null;
    if (ride.startLatitude && ride.startLongitude && ride.endLatitude && ride.endLongitude) {
        const tripDistance = calculateDistance(
            parseFloat(ride.startLatitude), parseFloat(ride.startLongitude),
            parseFloat(ride.endLatitude), parseFloat(ride.endLongitude)
        );
        const vehicleCategoryId = ride.service?.vehicleCategory?.id || ride.vehicleCategoryId;
        if (vehicleCategoryId) {
            const priceResult = await calculateTripPrice(vehicleCategoryId, tripDistance, ride.duration || 0, 0);
            if (priceResult.success) {
                realPrice = priceResult.totalAmount;
                priceBreakdown = priceResult.breakdown;
            }
        }
    }

    const percentChange = Math.round(((parsedFare - realPrice) / realPrice) * 10000) / 100;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute window for rider response

    await prisma.$transaction([
        prisma.rideRequest.update({
            where: { id: ride.id },
            data: {
                driverId: req.user.id,
                negotiatedFare: parsedFare,
                negotiationStatus: "pending",
                lastNegotiationBy: "driver",
                negotiationRounds: 1,
                negotiationExpiresAt: expiresAt,
            },
        }),
        prisma.rideNegotiation.create({
            data: {
                rideRequestId: ride.id,
                proposedBy: "driver",
                proposedFare: parsedFare,
                percentChange,
                action: "propose",
                round: 1,
            },
        }),
    ]);

    try {
        const { emitToUser } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) {
            const payload = {
                rideRequestId: ride.id,
                driverId: req.user.id,
                proposedFare: parsedFare,
                realPrice,
                originalFare: parseFloat(ride.totalAmount),
                expiresAt,
                offerType: 'negotiation',
            };
            emitToUser(io, ride.riderId, "ride-negotiation-offer", payload);
            // Unified event — rider app triggers near-drivers refresh on this
            emitToUser(io, ride.riderId, "driver-offer-received", payload);
        }
    } catch (_) {}

    emitDriverTripSyncFromReq(req, ride.id, "negotiation_propose");

    return successResponse(res, {
        rideRequestId: ride.id,
        proposedFare: parsedFare,
        realPrice,
        originalFare: parseFloat(ride.totalAmount),
        priceBreakdown,
        percentChange,
        negotiationStatus: "pending",
        expiresAt,
    }, "Negotiation offer sent to rider. Waiting for their response.");
});

// ─── Driver Polls Negotiation Status ─────────────────────────────────────────
// GET /negotiation/status/:rideRequestId
// Returns whether the rider accepted, rejected, or has not yet responded.
export const checkNegotiationStatus = asyncHandler(async (req, res) => {
    const rideId = parseRideRequestIdParam(req.params.rideRequestId);
    if (!rideId) return errorResponse(res, "Invalid rideRequestId", 400);

    const ride = await prisma.rideRequest.findUnique({
        where: { id: rideId },
        select: {
            id: true,
            driverId: true,
            riderId: true,
            status: true,
            totalAmount: true,
            negotiatedFare: true,
            negotiationStatus: true,
            negotiationExpiresAt: true,
            lastNegotiationBy: true,
        }
    });
    if (!ride) return errorResponse(res, "Ride request not found", 404);
    if (ride.driverId !== req.user.id) return errorResponse(res, "Not authorized", 403);

    let currentStatus = ride.negotiationStatus;
    let didAutoExpire = false;

    // Auto-expire if window passed without rider response
    if (currentStatus === "pending" && ride.negotiationExpiresAt && new Date() > new Date(ride.negotiationExpiresAt)) {
        currentStatus = "expired";
        didAutoExpire = true;
        await prisma.rideRequest.update({
            where: { id: ride.id },
            data: { negotiationStatus: "expired", driverId: null },
        });
    }

    if (didAutoExpire) {
        emitDriverTripSyncFromReq(req, ride.id, "negotiation_expired_auto", req.user.id);
    }

    return successResponse(res, {
        rideRequestId: ride.id,
        negotiationStatus: currentStatus,         // pending | accepted | rejected | expired
        originalFare: parseFloat(ride.totalAmount),
        negotiatedFare: ride.negotiatedFare != null ? parseFloat(ride.negotiatedFare) : null,
        rideStatus: ride.status,
        expiresAt: ride.negotiationExpiresAt,
    });
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

    const driverLat = parseFloat(latitude);
    const driverLng = parseFloat(longitude);

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

            prisma.user
                .findUnique({
                    where: { id: req.user.id },
                    select: { isOnline: true, isAvailable: true },
                })
                .then((u) => {
                    if (u?.isOnline && u?.isAvailable) {
                        return replayPendingRidesForDriver(io, req.user.id, driverLat, driverLng);
                    }
                })
                .catch(() => {});
        }
    } catch (_) {}

    return successResponse(res, { latitude, longitude }, "Location updated");
});
