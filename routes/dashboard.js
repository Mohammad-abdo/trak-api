import express from "express";
import {
    adminDashboard,
    riderDashboard,
    currentRideRequest,
    appsetting,
    getChartData,
} from "../controllers/dashboardController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/admin-dashboard", adminDashboard);
router.get("/rider-dashboard", authenticate, riderDashboard);
router.get("/current-riderequest", authenticate, currentRideRequest);
router.get("/appsetting", appsetting);
router.get("/chart-data", getChartData);

export default router;


