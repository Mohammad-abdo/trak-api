import prisma from "../utils/prisma.js";
import {
    verifyPayskySecureHash,
    buildPayskySignatureString,
    computePayskySecureHash,
} from "../utils/payskySecureHash.js";
import {
    completePaidGatewayPayment,
    getEffectiveRidePaymentTotal,
} from "../services/ridePaymentCompletionService.js";
import {
    PAYSKY_NOTIFICATION_PATH,
    buildPayskyWebhookUrlFromRequest,
    getConfiguredPayskyWebhookUrl,
    notifyPayskyWebhookAdmin,
    notifyPayskyWebhookAuthFailure,
} from "../utils/payskyWebhookAdminNotify.js";
import { payskyTripSimulationAllowed } from "./payskyRealPaymentsOnlyController.js";
import { parseRideRequestIdFromMerchantReference } from "../utils/rideRequestId.js";
import { getPayskyEnv, isPayskyProductionMode } from "../utils/payskyApi.js";

function payskyJson(res, statusCode, message, success) {
    return res.status(statusCode).json({ Message: message, Success: success });
}

/**
 * Handle wallet top-up payment webhook
 */
async function handleWalletTopup(req, res, body, merchantRef, systemRef) {
    const parts = merchantRef.split(":");
    if (parts.length < 3) {
        console.error("PaySky wallet topup webhook: invalid TOPUP reference format:", merchantRef);
        return payskyJson(res, 200, "Invalid reference format", false);
    }

    const walletId = parseInt(parts[1]);
    const divisor = parseInt(process.env.PAYSKY_AMOUNT_MINOR_DIVISOR || "100", 10) || 100;
    const amountMajor = parseFloat(body.Amount) / divisor;

    if (isNaN(walletId) || isNaN(amountMajor)) {
        console.error("PaySky wallet topup webhook: invalid wallet ID or amount", { walletId, amountMajor });
        return payskyJson(res, 200, "Invalid wallet ID or amount", false);
    }

    // Check if already processed (idempotency)
    const existingTopup = await prisma.walletHistory.findFirst({
        where: {
            walletId,
            transactionType: "topup",
            description: merchantRef,
        },
    });

    if (existingTopup) {
        console.log("PaySky wallet topup webhook: topup already processed for", merchantRef);
        return payskyJson(res, 200, "Topup already processed", true);
    }

    // Get wallet
    const wallet = await prisma.wallet.findUnique({
        where: { id: walletId },
    });

    if (!wallet) {
        console.error("PaySky wallet topup webhook: wallet not found:", walletId);
        return payskyJson(res, 200, "Wallet not found", false);
    }

    try {
        const newBalance = wallet.balance + amountMajor;

        const [updatedWallet, history] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: walletId },
                data: { balance: newBalance },
            }),
            prisma.walletHistory.create({
                data: {
                    walletId,
                    userId: wallet.userId,
                    type: "credit",
                    amount: amountMajor,
                    balance: newBalance,
                    description: merchantRef,
                    transactionType: "topup",
                },
            }),
        ]);

        console.log(`PaySky wallet topup webhook: topup successful. Wallet #${walletId}, amount: ${amountMajor}, new balance: ${newBalance}`);
        return payskyJson(res, 200, "Topup processed successfully", true);
    } catch (error) {
        console.error("PaySky wallet topup webhook: error processing topup:", error);
        return payskyJson(res, 200, "Error processing topup", false);
    }
}

/**
 * Browsers use GET when you paste the webhook URL — PaySky uses POST with JSON.
 * @route GET /api/payments/paysky/notification
 */
export const payskyNotificationGetHelp = (req, res) => {
    const fullUrl = buildPayskyWebhookUrlFromRequest(req);
    const configured = getConfiguredPayskyWebhookUrl();
    return res.status(200).json({
        success: true,
        notice:
            "This endpoint is for PaySky servers only: they send HTTP POST with application/json. A normal browser visit uses GET, so you are seeing this help response instead of a webhook.",
        usePost: true,
        path: PAYSKY_NOTIFICATION_PATH,
        sameHostGetMetadata: "GET /api/payments/paysky/webhook-info",
        staffTestPagePath: "/payments/paysky-test",
        inferredWebhookUrl: fullUrl,
        configuredWebhookUrl: configured || undefined,
        paySkyDocs: "https://paysky.io/docs/paysky-omni-gateway/",
    });
};

function mapPaidThroughToPaymentType(paidThrough) {
    const p = String(paidThrough ?? "").toLowerCase();
    if (p.includes("wallet") || p.includes("tahweel")) return "wallet";
    if (p.includes("mvisa") || p.includes("visa")) return "card";
    if (p.includes("card")) return "card";
    return "card";
}

function minorAmountToMajor(amountStr, divisor) {
    const minor = parseInt(String(amountStr ?? "").replace(/\s+/g, ""), 10);
    if (Number.isNaN(minor)) return null;
    return minor / divisor;
}

/**
 * @desc PaySky OMNI Notification Services webhook
 * @route POST /api/payments/paysky/notification
 * @access Public (HMAC SecureHash)
 */
export const payskyNotification = async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const secretHex = process.env.PAYSKY_SECRET_KEY_HEX;
    const expectedMerchant = process.env.PAYSKY_MERCHANT_ID;
    const expectedTerminal = process.env.PAYSKY_TERMINAL_ID;

    if (!secretHex) {
        console.error("PaySky webhook: PAYSKY_SECRET_KEY_HEX is not set");
        await notifyPayskyWebhookAdmin({
            success: false,
            titleEn: "PaySky: server not configured",
            titleAr: "PaySky: الخادم غير مهيأ",
            messageEn: "PAYSKY_SECRET_KEY_HEX is missing — webhooks cannot be verified.",
            messageAr: "لم يتم ضبط PAYSKY_SECRET_KEY_HEX — لا يمكن التحقق من الويب هوك.",
        });
        return payskyJson(res, 503, "PaySky notifications not configured", false);
    }

    if (!verifyPayskySecureHash(body, secretHex)) {
        await notifyPayskyWebhookAuthFailure("invalid_signature");
        return payskyJson(res, 401, "Unauthorized", false);
    }

    if (expectedMerchant && String(body.MerchantId ?? "") !== String(expectedMerchant)) {
        await notifyPayskyWebhookAuthFailure("merchant_id_mismatch");
        return payskyJson(res, 401, "Unauthorized", false);
    }
    if (expectedTerminal && String(body.TerminalId ?? "") !== String(expectedTerminal)) {
        await notifyPayskyWebhookAuthFailure("terminal_id_mismatch");
        return payskyJson(res, 401, "Unauthorized", false);
    }

    const txnType = parseInt(body.TxnType, 10);
    const systemRef = String(body.SystemReference ?? "").trim();
    const actionCode = body.ActionCode != null ? String(body.ActionCode).trim() : "";
    const merchantRef = String(body.MerchantReference ?? "").trim();

    // Handle wallet top-up (txnType 1 = sale, actionCode 00 = success)
    if (txnType === 1 && actionCode === "00" && merchantRef.startsWith("TOPUP:")) {
        return await handleWalletTopup(req, res, body, merchantRef, systemRef);
    }

    if (txnType === 1 && actionCode === "00") {
        const rideId = parseRideRequestIdFromMerchantReference(body.MerchantReference);
        if (rideId == null) {
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: sale declined (reference)",
                titleAr: "PaySky: رفض البيع (المرجع)",
                messageEn: `Missing or invalid MerchantReference. SystemReference: ${systemRef || "—"}.`,
                messageAr: `MerchantReference غير صالح أو مفقود. مرجع النظام: ${systemRef || "—"}.`,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Missing or invalid MerchantReference", false);
        }

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideId } });
        if (!rideRequest) {
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: sale declined (ride not found)",
                titleAr: "PaySky: رفض البيع (الرحلة غير موجودة)",
                messageEn: `Ride #${rideId} not found. SystemReference: ${systemRef || "—"}.`,
                messageAr: `الرحلة #${rideId} غير موجودة. مرجع النظام: ${systemRef || "—"}.`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Ride request not found", false);
        }

        if (rideRequest.driverId == null) {
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: sale declined (no driver)",
                titleAr: "PaySky: رفض البيع (لا يوجد سائق)",
                messageEn: `Ride #${rideId} has no driver assigned. SystemReference: ${systemRef || "—"}.`,
                messageAr: `الرحلة #${rideId} بلا سائق. مرجع النظام: ${systemRef || "—"}.`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Ride has no driver assigned", false);
        }

        const expectedNumericCurrency = process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC;
        if (expectedNumericCurrency && String(body.Currency ?? "") !== String(expectedNumericCurrency)) {
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: sale declined (currency)",
                titleAr: "PaySky: رفض البيع (العملة)",
                messageEn: `Ride #${rideId}: expected currency ${expectedNumericCurrency}, got ${body.Currency ?? "—"}.`,
                messageAr: `الرحلة #${rideId}: العملة المتوقعة ${expectedNumericCurrency}، الواردة ${body.Currency ?? "—"}.`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Currency mismatch", false);
        }

        const divisor = parseInt(process.env.PAYSKY_AMOUNT_MINOR_DIVISOR || "100", 10) || 100;
        const gatewayMajor = minorAmountToMajor(body.Amount, divisor);
        if (gatewayMajor == null) {
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: sale declined (amount format)",
                titleAr: "PaySky: رفض البيع (صيغة المبلغ)",
                messageEn: `Ride #${rideId}: invalid Amount field "${body.Amount ?? ""}".`,
                messageAr: `الرحلة #${rideId}: حقل المبلغ غير صالح "${body.Amount ?? ""}".`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Invalid Amount", false);
        }

        const rideTotal = getEffectiveRidePaymentTotal(rideRequest);
        const tolerance = 0.02;
        if (Math.abs(gatewayMajor - rideTotal) > tolerance) {
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: sale declined (amount mismatch)",
                titleAr: "PaySky: رفض البيع (عدم تطابق المبلغ)",
                messageEn: `Ride #${rideId}: gateway ${gatewayMajor} vs ride total ${rideTotal}. SystemReference: ${systemRef || "—"}.`,
                messageAr: `الرحلة #${rideId}: البوابة ${gatewayMajor} مقابل إجمالي الرحلة ${rideTotal}. مرجع النظام: ${systemRef || "—"}.`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Amount does not match ride total", false);
        }

        const existingByRef =
            systemRef &&
            (await prisma.payment.findFirst({
                where: { transactionId: systemRef, paymentStatus: "paid" },
            }));
        if (existingByRef && existingByRef.rideRequestId === rideId) {
            await notifyPayskyWebhookAdmin({
                success: true,
                titleEn: "PaySky: duplicate notification (already paid)",
                titleAr: "PaySky: إشعار مكرر (مدفوع مسبقاً)",
                messageEn: `Ride #${rideId} already marked paid for SystemReference ${systemRef}.`,
                messageAr: `الرحلة #${rideId} مسجلة كمدفوعة لمرجع النظام ${systemRef}.`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 200, "Success", true);
        }

        const paymentType = mapPaidThroughToPaymentType(body.PaidThrough);
        try {
            await completePaidGatewayPayment(prisma, rideRequest, {
                paymentType,
                transactionId: systemRef || null,
                paymentGateway: "paysky",
                amount: rideTotal,
            });
        } catch (err) {
            console.error("PaySky notification processing error:", err);
            await notifyPayskyWebhookAdmin({
                success: false,
                titleEn: "PaySky: payment processing error",
                titleAr: "PaySky: خطأ أثناء معالجة الدفع",
                messageEn: `Ride #${rideId}: ${err.message || "Processing error"}. SystemReference: ${systemRef || "—"}.`,
                messageAr: `الرحلة #${rideId}: ${err.message || "خطأ في المعالجة"}. مرجع النظام: ${systemRef || "—"}.`,
                rideRequestId: rideId,
                systemReference: systemRef || undefined,
                txnType,
                actionCode,
            });
            return payskyJson(res, 500, err.message || "Processing error", false);
        }

        await notifyPayskyWebhookAdmin({
            success: true,
            titleEn: "PaySky: ride payment completed",
            titleAr: "PaySky: تم إكمال دفع الرحلة",
            messageEn: `Ride #${rideId} marked paid (${paymentType}). Amount ${rideTotal}. SystemReference: ${systemRef || "—"}.`,
            messageAr: `الرحلة #${rideId} مسجلة كمدفوعة (${paymentType}). المبلغ ${rideTotal}. مرجع النظام: ${systemRef || "—"}.`,
            rideRequestId: rideId,
            systemReference: systemRef || undefined,
            txnType,
            actionCode,
        });
        return payskyJson(res, 200, "Success", true);
    }

    if (txnType === 1 && actionCode !== "00") {
        await notifyPayskyWebhookAdmin({
            success: false,
            titleEn: "PaySky: card / sale not approved",
            titleAr: "PaySky: لم تتم الموافقة على البيع",
            messageEn: `TxnType=1 but ActionCode=${actionCode || "—"}. SystemReference: ${systemRef || "—"}.`,
            messageAr: `نوع المعاملة 1 لكن رمز الإجراء ${actionCode || "—"}. مرجع النظام: ${systemRef || "—"}.`,
            systemReference: systemRef || undefined,
            txnType,
            actionCode,
        });
        return payskyJson(res, 200, "Acknowledged", true);
    }

    if ([2, 3, 4].includes(txnType)) {
        if (systemRef) {
            await prisma.payment
                .updateMany({
                    where: { transactionId: systemRef },
                    data: {
                        paymentStatus: txnType === 2 ? "refunded" : "void",
                    },
                })
                .catch(() => {});
        }
        await notifyPayskyWebhookAdmin({
            success: true,
            titleEn: "PaySky: refund / void acknowledged",
            titleAr: "PaySky: تم الاعتراف بالاسترداد أو الإلغاء",
            messageEn: `TxnType ${txnType}. SystemReference: ${systemRef || "—"}. Payments updated where matched.`,
            messageAr: `نوع المعاملة ${txnType}. مرجع النظام: ${systemRef || "—"}.`,
            systemReference: systemRef || undefined,
            txnType,
            actionCode,
        });
        return payskyJson(res, 200, "Acknowledged", true);
    }

    await notifyPayskyWebhookAdmin({
        success: true,
        titleEn: "PaySky: notification acknowledged",
        titleAr: "PaySky: تم استلام الإشعار",
        messageEn: `TxnType ${txnType ?? "—"}, ActionCode ${actionCode || "—"}. SystemReference: ${systemRef || "—"}. No ride payment change.`,
        messageAr: `نوع المعاملة ${txnType ?? "—"}، رمز الإجراء ${actionCode || "—"}. مرجع النظام: ${systemRef || "—"}.`,
        systemReference: systemRef || undefined,
        txnType,
        actionCode,
    });
    return payskyJson(res, 200, "Acknowledged", true);
};

/**
 * Public metadata for dashboard operators (configure PaySky callback URL).
 * @route GET /api/payments/paysky/webhook-info
 */
export const payskyWebhookInfo = async (req, res) => {
    const fullUrl = buildPayskyWebhookUrlFromRequest(req);
    const configuredWebhookUrl = getConfiguredPayskyWebhookUrl();
    return res.json({
        success: true,
        data: {
            method: "POST",
            path: PAYSKY_NOTIFICATION_PATH,
            fullUrl,
            configuredWebhookUrl,
            contentType: "application/json",
            secretConfigured: !!String(process.env.PAYSKY_SECRET_KEY_HEX || "").trim(),
            merchantIdCheckEnabled: !!String(process.env.PAYSKY_MERCHANT_ID || "").trim(),
            terminalIdCheckEnabled: !!String(process.env.PAYSKY_TERMINAL_ID || "").trim(),
            merchantReferenceHint:
                "Set MerchantReference to the ride ID (integer), or prefixed forms like RIDE:<id>.",
            docsUrl: "https://paysky.io/docs/paysky-omni-gateway/",
            simulateTripPaymentEnabled: payskyTripSimulationAllowed(),
        },
    });
};

/**
 * Tiny diagnostic endpoint for runtime PaySky environment verification.
 * @route GET /api/payments/paysky/runtime-info
 */
export const payskyRuntimeInfo = async (req, res) => {
    const env = getPayskyEnv();
    const configuredWebhookUrl = getConfiguredPayskyWebhookUrl();
    const runtimeWebhookUrl =
        configuredWebhookUrl || buildPayskyWebhookUrlFromRequest(req) || undefined;
    const mode = isPayskyProductionMode() ? "production" : "test";

    console.info(
        `[PaySky runtime] mode=${mode} jsUrl=${env.JS_URL} apiBase=${env.API_BASE} webhook=${runtimeWebhookUrl || "unset"}`
    );

    return res.json({
        success: true,
        data: {
            mode,
            jsUrl: env.JS_URL,
            apiBase: env.API_BASE,
            webhookUrl: runtimeWebhookUrl,
            nodeEnv: process.env.NODE_ENV || "development",
            merchantId: String(process.env.PAYSKY_MERCHANT_ID || "").trim() || undefined,
            terminalId: String(process.env.PAYSKY_TERMINAL_ID || "").trim() || undefined,
            currencyNumeric:
                String(process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC || "").trim() || undefined,
            simulationEnabled: payskyTripSimulationAllowed(),
        },
    });
};

/**
 * Build Appendix A SecureHash for debugging (staff only). Does not record a payment.
 * @route POST /api/payments/paysky/debug-build-hash
 */
export const payskyDebugBuildHash = async (req, res) => {
    const secretHex = process.env.PAYSKY_SECRET_KEY_HEX;
    if (!secretHex || !String(secretHex).trim()) {
        return res.status(503).json({
            success: false,
            message: "PAYSKY_SECRET_KEY_HEX is not configured on the server",
        });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const { Amount, Currency, DateTimeLocalTrxn, MerchantId, TerminalId } = body;
    if (
        Amount == null ||
        Currency == null ||
        DateTimeLocalTrxn == null ||
        MerchantId == null ||
        TerminalId == null
    ) {
        return res.status(400).json({
            success: false,
            message: "Body must include Amount, Currency, DateTimeLocalTrxn, MerchantId, TerminalId",
        });
    }
    try {
        const canonicalString = buildPayskySignatureString({
            Amount,
            Currency,
            DateTimeLocalTrxn,
            MerchantId,
            TerminalId,
        });
        const SecureHash = computePayskySecureHash(canonicalString, secretHex);
        return res.json({
            success: true,
            data: { canonicalString, SecureHash },
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message || "Invalid parameters or secret key hex",
        });
    }
};
