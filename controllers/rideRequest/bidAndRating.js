import prisma from "../../utils/prisma.js";
import { parseRideRequestIdParam } from "../../utils/rideRequestId.js";

// @desc    Verify coupon
// @route   POST /api/ride-requests/verify-coupon
export const verifyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;
        const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });

        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

        res.json({ success: true, message: "Coupon verified", data: { discount: coupon.discount || 0, couponCode: coupon.code } });
    } catch (error) {
        console.error("Verify coupon error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Apply bid
// @route   POST /api/ride-requests/apply-bid
export const applyBid = async (req, res) => {
    try {
        const { rideRequestId, bidAmount } = req.body;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!rideRequest) return res.status(404).json({ success: false, message: "Ride request not found" });

        await prisma.rideRequestBid.create({ data: { rideRequestId: rideId, driverId: req.user.id, bidAmount } });
        await prisma.rideRequest.update({ where: { id: rideId }, data: { rideHasBid: true } });

        res.json({ success: true, message: "Bid applied successfully" });
    } catch (error) {
        console.error("Apply bid error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get bidding drivers
// @route   POST /api/ride-requests/get-bidding-riderequest
export const getBiddingDrivers = async (req, res) => {
    try {
        const { rideRequestId } = req.body;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });
        const bids = await prisma.rideRequestBid.findMany({
            where: { rideRequestId: rideId },
            include: { driver: { select: { id: true, firstName: true, lastName: true } } },
        });
        res.json({ success: true, data: bids.map((bid) => bid.driver) });
    } catch (error) {
        console.error("Get bidding drivers error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Accept bid request
// @route   POST /api/ride-requests/riderequest-bid-respond
export const acceptBidRequest = async (req, res) => {
    try {
        const { rideRequestId, driverId, accept } = req.body;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!rideRequest) return res.status(404).json({ success: false, message: "Ride request not found" });

        if (accept) {
            await prisma.rideRequest.update({ where: { id: rideId }, data: { driverId, status: "accepted" } });
            await prisma.rideRequestBid.updateMany({ where: { rideRequestId: rideId, driverId }, data: { isBidAccept: true } });
        }

        const updatedRideRequest = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        res.json({ success: true, message: accept ? "Bid accepted" : "Bid rejected", data: updatedRideRequest });
    } catch (error) {
        console.error("Accept bid request error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Rate ride
// @route   POST /api/ride-requests/save-ride-rating
export const rideRating = async (req, res) => {
    try {
        const { rideRequestId, rating, comment, ratingBy } = req.body;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) return res.status(400).json({ success: false, message: "Invalid rideRequestId" });

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!rideRequest) return res.status(404).json({ success: false, message: "Ride request not found" });

        await prisma.rideRequestRating.create({
            data: { rideRequestId: rideId, riderId: rideRequest.riderId, driverId: rideRequest.driverId, rating, comment, ratingBy },
        });

        if (ratingBy === "rider") {
            await prisma.rideRequest.update({ where: { id: rideId }, data: { isRiderRated: true } });
        } else if (ratingBy === "driver") {
            await prisma.rideRequest.update({ where: { id: rideId }, data: { isDriverRated: true } });
        }

        res.json({ success: true, message: "Rating saved successfully" });
    } catch (error) {
        console.error("Ride rating error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
