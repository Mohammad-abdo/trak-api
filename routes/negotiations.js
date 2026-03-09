import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
    getSettings,
    startNegotiation,
    counterOffer,
    acceptNegotiation,
    rejectNegotiation,
    getNegotiationHistory,
} from "../controllers/negotiationController.js";

const router = express.Router();

// Public — mobile apps can read negotiation feature settings
router.get("/settings", getSettings);

// All actions below require authentication
router.post("/start", authenticate, startNegotiation);
router.post("/counter", authenticate, counterOffer);
router.post("/accept", authenticate, acceptNegotiation);
router.post("/reject", authenticate, rejectNegotiation);
router.get("/history/:rideRequestId", authenticate, getNegotiationHistory);

export default router;
