import express from "express";
import { getPaymentGatewayList } from "../controllers/paymentGatewayController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/payment-gateway-list", authenticate, getPaymentGatewayList);

export default router;



