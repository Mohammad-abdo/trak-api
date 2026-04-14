import prisma from "../utils/prisma.js";
import { parseRideRequestIdParam } from "../utils/rideRequestId.js";
import { getEffectiveRidePaymentTotal } from "../services/ridePaymentCompletionService.js";
import {
    isPayskyConfigured,
    generatePayskyPaymentConfig,
    getAmountMinorUnit,
    getPayskyEnv,
} from "../utils/payskyApi.js";

/**
 * Get Paysky configuration for frontend Lightbox payment
 * @route POST /api/payments/paysky/init
 * @access Private
 */
export const payskyInitPayment = async (req, res) => {
    try {
        if (!isPayskyConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Paysky payment is not configured on this server",
            });
        }

        const { rideRequestId } = req.body;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing rideRequestId",
            });
        }

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        const uid = req.user.id;
        const isRider = rideRequest.riderId === uid;
        const isAdmin = req.user.userType === "admin";

        if (!isRider && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Only the rider or admin can initiate payment for this ride",
            });
        }

        if (rideRequest.driverId == null) {
            return res.status(400).json({
                success: false,
                message: "Cannot pay for a ride that has no driver assigned",
            });
        }

        const existingPaid = await prisma.payment.findFirst({
            where: { rideRequestId: rideId, paymentStatus: "paid" },
        });
        if (existingPaid) {
            return res.status(400).json({
                success: false,
                message: "This ride has already been paid",
                data: { alreadyPaid: true, paymentId: existingPaid.id },
            });
        }

        const amount = getEffectiveRidePaymentTotal(rideRequest);
        const amountMinor = getAmountMinorUnit(amount);
        const merchantReference = `RIDE:${rideId}`;

        const config = generatePayskyPaymentConfig({
            merchantReference,
            amountMinor,
        });

        const env = getPayskyEnv();

        res.json({
            success: true,
            data: {
                paymentConfig: {
                    mid: config.merchantId,
                    tid: config.terminalId,
                    amountTrxn: config.amountTrxn,
                    merchantReference: config.merchantReference,
                    trxDateTime: config.transactionDatetime,
                    secureHash: config.secureHash,
                    currency: config.currency,
                    expiresAt: config.expiresAt,
                },
                environment: process.env.NODE_ENV || "development",
                lightboxJsUrl: env.JS_URL,
                callbackUrl: `${req.protocol}://${req.get("host")}/api/payments/paysky/notification`,
            },
        });
    } catch (error) {
        console.error("Paysky init payment error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Confirm payment after successful Paysky callback (called from frontend or webhook)
 * @route POST /api/payments/paysky/confirm
 * @access Private
 */
export const payskyConfirmPayment = async (req, res) => {
    try {
        const { rideRequestId, systemReference, amount, paidThrough, payerAccount, secureHash } = req.body;
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing rideRequestId",
            });
        }

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        const existingPaid = await prisma.payment.findFirst({
            where: { rideRequestId: rideId, paymentStatus: "paid" },
        });
        if (existingPaid) {
            return res.json({
                success: true,
                message: "Payment already recorded",
                data: { alreadyPaid: true, paymentId: existingPaid.id },
            });
        }

        const { completePaidGatewayPayment } = await import(
            "../services/ridePaymentCompletionService.js"
        );

        const payment = await completePaidGatewayPayment(prisma, rideRequest, {
            paymentType: paidThrough || "card",
            transactionId: systemReference || null,
            paymentGateway: "paysky",
            amount: parseFloat(amount) || undefined,
        });

        res.json({
            success: true,
            message: "Payment confirmed successfully",
            data: { paymentId: payment.id, rideRequestId: rideId },
        });
    } catch (error) {
        console.error("Paysky confirm payment error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
