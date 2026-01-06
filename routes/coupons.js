import express from "express";
import {
    getCouponList,
    getCouponDetail,
    createCoupon,
    updateCoupon,
    deleteCoupon,
} from "../controllers/couponController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public/Private routes
router.get("/coupon-list", authenticate, getCouponList);

// Admin CRUD routes
router.get("/:id", authenticate, authorize("admin"), getCouponDetail);
router.post("/", authenticate, authorize("admin"), createCoupon);
router.put("/:id", authenticate, authorize("admin"), updateCoupon);
router.delete("/:id", authenticate, authorize("admin"), deleteCoupon);

export default router;
