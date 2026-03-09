import prisma from "../../utils/prisma.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/serverResponse.js";
import { getDriverAndSystemShare } from "../../utils/settingsHelper.js";

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
    const ride = await prisma.rideRequest.findUnique({
        where: { id: parseInt(req.params.id) },
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

// Accept or reject incoming ride request
export const respondToRide = asyncHandler(async (req, res) => {
    const { rideRequestId, accept } = req.body;
    if (!rideRequestId) return errorResponse(res, "rideRequestId is required", 400);

    const ride = await prisma.rideRequest.findUnique({ where: { id: parseInt(rideRequestId) } });
    if (!ride) return errorResponse(res, "Ride request not found", 404);

    if (accept) {
        await prisma.rideRequest.update({
            where: { id: ride.id },
            data: { driverId: req.user.id, status: "accepted" },
        });
        try {
            const { emitToRide } = await import("../../utils/socketService.js");
            const io = req.app.get("io") || global.io;
            if (io) emitToRide(io, ride.id, "ride-request-accepted", { driverId: req.user.id, rideRequestId: ride.id });
        } catch (_) {}
    } else {
        const cancelledIds = ride.cancelledDriverIds ? JSON.parse(ride.cancelledDriverIds) : [];
        cancelledIds.push(req.user.id);
        await prisma.rideRequest.update({
            where: { id: ride.id },
            data: { cancelledDriverIds: JSON.stringify(cancelledIds) },
        });
    }

    const updated = await prisma.rideRequest.findUnique({ where: { id: ride.id } });
    return successResponse(res, updated, accept ? "Ride accepted" : "Ride rejected");
});

// Update ride status (arrived, started)
export const updateRideStatus = asyncHandler(async (req, res) => {
    const { rideRequestId, status } = req.body;
    const allowed = ["arrived", "started"];
    if (!allowed.includes(status)) return errorResponse(res, `status must be one of: ${allowed.join(", ")}`, 400);

    const ride = await prisma.rideRequest.findUnique({ where: { id: parseInt(rideRequestId) } });
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
    const { rideRequestId, tips } = req.body;

    const ride = await prisma.rideRequest.findUnique({ where: { id: parseInt(rideRequestId) } });
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
    const { rideRequestId, reason } = req.body;

    const ride = await prisma.rideRequest.findUnique({ where: { id: parseInt(rideRequestId) } });
    if (!ride) return errorResponse(res, "Ride not found", 404);
    if (ride.driverId !== req.user.id) return errorResponse(res, "Not authorized", 403);

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

    const ride = await prisma.rideRequest.findUnique({ where: { id: parseInt(rideRequestId) } });
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

    const ride = await prisma.rideRequest.findUnique({ where: { id: parseInt(rideRequestId) } });
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
        const { emitDriverLocationUpdate } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) emitDriverLocationUpdate(io, req.user.id, { lat: latitude, lng: longitude, heading: currentHeading });
    } catch (_) {}

    return successResponse(res, { latitude, longitude }, "Location updated");
});
