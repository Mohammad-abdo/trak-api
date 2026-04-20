import prisma from "../utils/prisma.js";
import { parseRideRequestIdFromMerchantReference, parseRideRequestIdParam } from "../utils/rideRequestId.js";
import { getEffectiveRidePaymentTotal } from "../services/ridePaymentCompletionService.js";
import { verifyPayskySecureHash } from "../utils/payskySecureHash.js";
import {
    isPayskyConfigured,
    generatePayskyPaymentConfig,
    getAmountMinorUnit,
    getPayskyEnv,
    isPayskyProductionMode,
} from "../utils/payskyApi.js";
import {
    buildPayskyWebhookUrlFromRequest,
    getConfiguredPayskyWebhookUrl,
    PAYSKY_NOTIFICATION_PATH,
} from "../utils/payskyWebhookAdminNotify.js";

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
        const callbackUrl =
            getConfiguredPayskyWebhookUrl() ||
            buildPayskyWebhookUrlFromRequest(req) ||
            `${req.protocol}://${req.get("host")}${PAYSKY_NOTIFICATION_PATH}`;

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
                payskyEnvironment: isPayskyProductionMode() ? "production" : "test",
                lightboxJsUrl: env.JS_URL,
                callbackUrl,
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
        const {
            rideRequestId,
            systemReference,
            amount,
            paidThrough,
            secureHash,
            merchantId,
            terminalId,
            merchantReference,
            dateTimeLocalTrxn,
            currency,
            actionCode,
            txnType,
        } = req.body;
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
                message: "Only the rider or admin can confirm payment for this ride",
            });
        }

        if (rideRequest.driverId == null) {
            return res.status(400).json({
                success: false,
                message: "Cannot confirm payment for a ride that has no driver assigned",
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

        const expectedAmount = getEffectiveRidePaymentTotal(rideRequest);
        const normalizedAmount = Number.parseFloat(amount);
        if (!Number.isFinite(normalizedAmount)) {
            return res.status(400).json({
                success: false,
                message: "A valid payment amount is required",
            });
        }

        const tolerance = 0.02;
        if (Math.abs(normalizedAmount - expectedAmount) > tolerance) {
            return res.status(400).json({
                success: false,
                message: "Payment amount does not match the ride total",
            });
        }

        const divisor = parseInt(process.env.PAYSKY_AMOUNT_MINOR_DIVISOR || "100", 10) || 100;
        const payloadForVerification = {
            Amount: String(Math.round(normalizedAmount * divisor)),
            Currency: String(currency ?? process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC ?? "").trim(),
            DateTimeLocalTrxn: String(dateTimeLocalTrxn ?? "").trim(),
            MerchantId: String(merchantId ?? "").trim(),
            TerminalId: String(terminalId ?? "").trim(),
            SecureHash: String(secureHash ?? "").trim(),
        };

        if (
            !payloadForVerification.DateTimeLocalTrxn ||
            !payloadForVerification.MerchantId ||
            !payloadForVerification.TerminalId ||
            !payloadForVerification.SecureHash
        ) {
            return res.status(400).json({
                success: false,
                message: "Signed PaySky confirmation fields are required",
            });
        }

        const secretHex = String(process.env.PAYSKY_SECRET_KEY_HEX || "").trim();
        if (!secretHex || !verifyPayskySecureHash(payloadForVerification, secretHex)) {
            return res.status(401).json({
                success: false,
                message: "Invalid PaySky signature",
            });
        }

        const expectedMerchant = String(process.env.PAYSKY_MERCHANT_ID || "").trim();
        if (expectedMerchant && payloadForVerification.MerchantId !== expectedMerchant) {
            return res.status(401).json({
                success: false,
                message: "Merchant ID mismatch",
            });
        }

        const expectedTerminal = String(process.env.PAYSKY_TERMINAL_ID || "").trim();
        if (expectedTerminal && payloadForVerification.TerminalId !== expectedTerminal) {
            return res.status(401).json({
                success: false,
                message: "Terminal ID mismatch",
            });
        }

        const expectedCurrency = String(
            currency ?? process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC ?? ""
        ).trim();
        const configuredCurrency = String(process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC || "").trim();
        if (configuredCurrency && expectedCurrency !== configuredCurrency) {
            return res.status(400).json({
                success: false,
                message: "Currency mismatch",
            });
        }

        const merchantReferenceRideId = parseRideRequestIdFromMerchantReference(
            merchantReference ?? `RIDE:${rideId}`
        );
        if (merchantReferenceRideId !== rideId) {
            return res.status(400).json({
                success: false,
                message: "Merchant reference does not match this ride",
            });
        }

        if (txnType != null && String(txnType).trim() !== "1") {
            return res.status(400).json({
                success: false,
                message: "Only approved sale confirmations can be recorded",
            });
        }

        if (actionCode != null && String(actionCode).trim() !== "00") {
            return res.status(400).json({
                success: false,
                message: "PaySky did not approve this payment",
            });
        }

        const { completePaidGatewayPayment } = await import(
            "../services/ridePaymentCompletionService.js"
        );

        const payment = await completePaidGatewayPayment(prisma, rideRequest, {
            paymentType: paidThrough || "card",
            transactionId: systemReference || null,
            paymentGateway: "paysky",
            amount: expectedAmount,
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
