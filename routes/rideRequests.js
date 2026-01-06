import express from "express";
import {
    createRideRequest,
    getRideRequestList,
    getRideRequestDetail,
    updateRideRequest,
    deleteRideRequest,
    acceptRideRequest,
    completeRideRequest,
    verifyCoupon,
    applyBid,
    getBiddingDrivers,
    acceptBidRequest,
    rideRating,
    updateDropLocation,
    exportRideRequests,
} from "../controllers/rideRequestController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/save-riderequest", authenticate, createRideRequest);
router.get("/riderequest-list", authenticate, getRideRequestList);
router.get("/riderequest-detail", authenticate, getRideRequestDetail);
router.post("/riderequest-update/:id", authenticate, updateRideRequest);
router.post("/riderequest-delete/:id", authenticate, deleteRideRequest);
router.post("/riderequest-respond", authenticate, acceptRideRequest);
router.post("/complete-riderequest", authenticate, completeRideRequest);
router.post("/verify-coupon", authenticate, verifyCoupon);
router.post("/apply-bid", authenticate, applyBid);
router.post("/get-bidding-riderequest", authenticate, getBiddingDrivers);
router.post("/riderequest-bid-respond", authenticate, acceptBidRequest);
router.post("/save-ride-rating", authenticate, rideRating);
router.post("/riderequest/:id/drop/:index", authenticate, updateDropLocation);

// Export route (admin only)
router.get("/export", authenticate, authorize("admin"), exportRideRequests);

export default router;
