import express from "express";
import {
    getPaymentList,
    savePayment,
    driverEarningList,
} from "../controllers/paymentController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getPaymentList);
router.post("/save-payment", authenticate, savePayment);
router.post("/earning-list", authenticate, driverEarningList);

export default router;
