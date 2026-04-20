import prisma from "../../utils/prisma.js";
import {
    verifyPayskySecureHash,
} from "../../utils/payskySecureHash.js";
import {
    getPayskyEnv,
} from "../../utils/payskyApi.js";

function payskyJson(res, statusCode, message, success) {
    return res.status(statusCode).json({ Message: message, Success: success });
}

/**
 * @deprecated Use `payskyNotification` in `payskyNotificationController.js` — also mounted at
 * `POST /api/payments/paysky/wallet-notification` in `routes/payments.js` (same handler as `/paysky/notification`).
 * This duplicate implementation is retained for reference only.
 * @route POST /api/payments/paysky/wallet-notification
 */
export const payskyWalletNotification = async (req, res) => {
    const body = req.body;

    // Verify authentication
    const secretHex = process.env.PAYSKY_SECRET_KEY_HEX;
    const expectedMerchant = process.env.PAYSKY_MERCHANT_ID;
    const expectedTerminal = process.env.PAYSKY_TERMINAL_ID;

    if (!secretHex) {
        console.error("PaySky wallet webhook: PAYSKY_SECRET_KEY_HEX is not set");
        return payskyJson(res, 503, "PaySky notifications not configured", false);
    }

    if (!verifyPayskySecureHash(body, secretHex)) {
        console.error("PaySky wallet webhook: invalid signature");
        return payskyJson(res, 401, "Unauthorized", false);
    }

    if (expectedMerchant && String(body.MerchantId ?? "") !== String(expectedMerchant)) {
        return payskyJson(res, 401, "Unauthorized - Merchant ID mismatch", false);
    }
    if (expectedTerminal && String(body.TerminalId ?? "") !== String(expectedTerminal)) {
        return payskyJson(res, 401, "Unauthorized - Terminal ID mismatch", false);
    }

    const txnType = parseInt(body.TxnType, 10);
    const systemRef = String(body.SystemReference ?? "").trim();
    const actionCode = body.ActionCode != null ? String(body.ActionCode).trim() : "";
    const merchantRef = String(body.MerchantReference ?? "").trim();

    // Handle successful top-up (txnType 1 = sale, actionCode 00 = success)
    if (txnType === 1 && actionCode === "00") {
        // Parse: TOPUP:{walletId}:{timestamp}
        if (!merchantRef.startsWith("TOPUP:")) {
            return payskyJson(res, 200, "Not a wallet topup reference", true);
        }

        const parts = merchantRef.split(":");
        if (parts.length < 3) {
            console.error("PaySky wallet webhook: invalid TOPUP reference format:", merchantRef);
            return payskyJson(res, 200, "Invalid reference format", false);
        }

        const walletId = parseInt(parts[1]);
        const divisor = parseInt(process.env.PAYSKY_AMOUNT_MINOR_DIVISOR || "100", 10) || 100;
        const amountMajor = parseFloat(body.Amount) / divisor;

        if (isNaN(walletId) || isNaN(amountMajor)) {
            console.error("PaySky wallet webhook: invalid wallet ID or amount", { walletId, amountMajor });
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
            console.log("PaySky wallet webhook: topup already processed for", merchantRef);
            return payskyJson(res, 200, "Topup already processed", true);
        }

        // Get wallet and user
        const wallet = await prisma.wallet.findUnique({
            where: { id: walletId },
        });

        if (!wallet) {
            console.error("PaySky wallet webhook: wallet not found:", walletId);
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

            console.log(`PaySky wallet webhook: topup successful. Wallet #${walletId}, amount: ${amountMajor}, new balance: ${newBalance}`);
            return payskyJson(res, 200, "Topup processed successfully", true);
        } catch (error) {
            console.error("PaySky wallet webhook: error processing topup:", error);
            return payskyJson(res, 200, "Error processing topup", false);
        }
    }

    // Handle declined/failed payments
    if (txnType === 1 && actionCode !== "00") {
        if (merchantRef.startsWith("TOPUP:")) {
            console.log("PaySky wallet webhook: topup declined. MerchantReference:", merchantRef, "ActionCode:", actionCode);
        }
        return payskyJson(res, 200, "Payment declined or pending", true);
    }

    // Handle other txn types
    return payskyJson(res, 200, "Notification received", true);
};
