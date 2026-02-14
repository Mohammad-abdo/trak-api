import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import adminPromotions from "./adminPromotions.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize("admin"));

router.use("/promotions", adminPromotions);

export default router;


