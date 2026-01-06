import express from "express";
import {
    getDemandZones,
    getNearbyDrivers,
} from "../controllers/demandMapController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Admin routes
router.get("/zones", authenticate, authorize("admin"), getDemandZones);
router.get("/nearby-drivers", authenticate, getNearbyDrivers);

export default router;


