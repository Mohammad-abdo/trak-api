import express from "express";
import {
    driverEarningList,
    getPaymentList,
    savePayment,
} from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Admin / staff
router.get("/", authenticate, authorize("admin", "sub_admin"), getPaymentList);

// Rider/Driver/Admin: records wallet/cash payments for a ride (controller enforces access)
router.post("/save-payment", authenticate, savePayment);

// Driver earnings
router.post("/earning-list", authenticate, authorize("driver"), driverEarningList);

export default router;
