import prisma from "../../utils/prisma.js";
import { isPayskyConfigured } from "../../utils/payskyApi.js";
import { processPayskyCardPayment } from "../../utils/payskyCardPayment.js";
import { verifyPayskySecureHash } from "../../utils/payskySecureHash.js";

async function getOrCreateWallet(userId) {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
        wallet = await prisma.wallet.create({
            data: {
                userId,
                balance: 0,
            },
        });
    }
    return wallet;
}

async function creditWalletIfNotProcessed({ wallet, userId, amount, reference, transactionId = null }) {
    const existingTopup = await prisma.walletHistory.findFirst({
        where: {
            walletId: wallet.id,
            transactionType: "topup",
            description: reference,
        },
    });

    if (existingTopup) {
        return {
            alreadyProcessed: true,
            balance: wallet.balance,
            amount,
            transactionId,
        };
    }

    const newBalance = wallet.balance + amount;
    const [updatedWallet] = await prisma.$transaction([
        prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
        }),
        prisma.walletHistory.create({
            data: {
                walletId: wallet.id,
                userId,
                type: "credit",
                amount,
                balance: newBalance,
                description: reference,
                transactionType: "topup",
            },
        }),
    ]);

    return {
        alreadyProcessed: false,
        balance: updatedWallet.balance,
        amount,
        transactionId,
    };
}

// @desc    Single wallet top-up endpoint (card, signed confirm, or simulate)
// @route   POST /apimobile/driver/wallet/topup
// @access  Private (Driver)
export const topupWallet = async (req, res) => {
    try {
        const { amount } = req.body;
        const topupAmount = parseFloat(amount);
        if (!topupAmount || Number.isNaN(topupAmount) || topupAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount. Amount must be a positive number.",
            });
        }

        const secureHash = String(req.body.SecureHash ?? req.body.secureHash ?? "").trim();
        const merchantReference = String(req.body.merchantReference ?? "").trim();
        const isConfirmPayload = merchantReference.startsWith("TOPUP:");
        const isSignedConfirm = secureHash && isConfirmPayload;
        const hasCardDetails =
            !!req.body.cardNumber &&
            !!req.body.expiryMonth &&
            !!req.body.expiryYear &&
            !!req.body.cvv &&
            !!req.body.cardHolderName;

        // Flow A: Signed callback confirmation payload.
        if (isConfirmPayload) {
            const merchantId = String(req.body.MerchantId ?? req.body.merchantId ?? "").trim();
            const terminalId = String(req.body.TerminalId ?? req.body.terminalId ?? "").trim();
            const dateTimeLocalTrxn = String(
                req.body.DateTimeLocalTrxn ?? req.body.dateTimeLocalTrxn ?? ""
            ).trim();
            const currency = String(req.body.Currency ?? req.body.currency ?? "").trim();
            const gatewayAmountMinorRaw = String(req.body.Amount ?? req.body.amountMinor ?? "").trim();

            if (!secureHash || !merchantId || !terminalId || !dateTimeLocalTrxn || !currency || !gatewayAmountMinorRaw) {
                return res.status(400).json({
                    success: false,
                    message: "Signed PaySky confirmation fields are required",
                });
            }

            const gatewayAmountMinor = parseInt(gatewayAmountMinorRaw, 10);
            if (Number.isNaN(gatewayAmountMinor) || gatewayAmountMinor <= 0) {
                return res.status(400).json({ success: false, message: "Invalid signed amount" });
            }

            const signedPayload = {
                Amount: String(gatewayAmountMinor),
                Currency: currency,
                DateTimeLocalTrxn: dateTimeLocalTrxn,
                MerchantId: merchantId,
                TerminalId: terminalId,
                SecureHash: secureHash,
            };

            const secretHex = String(process.env.PAYSKY_SECRET_KEY_HEX || "").trim();
            if (!secretHex || !verifyPayskySecureHash(signedPayload, secretHex)) {
                return res.status(401).json({ success: false, message: "Invalid PaySky signature" });
            }

            const expectedMerchant = String(process.env.PAYSKY_MERCHANT_ID || "").trim();
            if (expectedMerchant && merchantId !== expectedMerchant) {
                return res.status(401).json({ success: false, message: "Merchant ID mismatch" });
            }

            const expectedTerminal = String(process.env.PAYSKY_TERMINAL_ID || "").trim();
            if (expectedTerminal && terminalId !== expectedTerminal) {
                return res.status(401).json({ success: false, message: "Terminal ID mismatch" });
            }

            const configuredCurrency = String(process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC || "").trim();
            if (configuredCurrency && currency !== configuredCurrency) {
                return res.status(400).json({ success: false, message: "Currency mismatch" });
            }

            const divisor = parseInt(process.env.PAYSKY_AMOUNT_MINOR_DIVISOR || "100", 10) || 100;
            const signedAmount = gatewayAmountMinor / divisor;
            if (Math.abs(signedAmount - topupAmount) > 0.02) {
                return res.status(400).json({
                    success: false,
                    message: "Signed amount does not match requested amount",
                });
            }

            const parts = merchantReference.split(":");
            const walletId = parseInt(parts[1], 10);
            if (parts.length < 3 || Number.isNaN(walletId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid merchant reference",
                });
            }

            const wallet = await prisma.wallet.findFirst({
                where: { id: walletId, userId: req.user.id },
            });
            if (!wallet) {
                return res.status(404).json({
                    success: false,
                    message: "Wallet not found",
                });
            }

            const credited = await creditWalletIfNotProcessed({
                wallet,
                userId: req.user.id,
                amount: signedAmount,
                reference: merchantReference,
                transactionId: req.body.systemReference || null,
            });

            return res.json({
                success: true,
                message: credited.alreadyProcessed ? "Topup already processed" : "Wallet topped up successfully",
                data: {
                    newBalance: credited.balance,
                    topupAmount: credited.amount,
                    transactionId: credited.transactionId,
                },
            });
        }

        // Flow B: Direct card charge.
        if (hasCardDetails) {
            const wallet = await getOrCreateWallet(req.user.id);
            if (!isPayskyConfigured()) {
                return res.status(503).json({
                    success: false,
                    message: "Payment service is not configured on this server",
                });
            }

            const reference = merchantReference || `TOPUP:${wallet.id}:${Date.now()}`;
            const paymentResult = await processPayskyCardPayment({
                amount: topupAmount,
                cardNumber: req.body.cardNumber,
                expiryMonth: req.body.expiryMonth,
                expiryYear: req.body.expiryYear,
                cvv: req.body.cvv,
                cardHolderName: req.body.cardHolderName,
                merchantReference: reference,
                userId: req.user.id,
            });

            if (!paymentResult.success) {
                return res.json({
                    success: false,
                    message: paymentResult.message || "Payment failed",
                    responseCode: paymentResult.responseCode,
                });
            }

            const credited = await creditWalletIfNotProcessed({
                wallet,
                userId: req.user.id,
                amount: topupAmount,
                reference,
                transactionId: paymentResult.systemReference || null,
            });

            return res.json({
                success: true,
                message: credited.alreadyProcessed ? "Topup already processed" : "Wallet topped up successfully",
                data: {
                    newBalance: credited.balance,
                    topupAmount: credited.amount,
                    transactionId: credited.transactionId,
                },
            });
        }

        // Flow C: Simulation fallback for QA (explicit flag).
        if (req.body.simulate === true) {
            const wallet = await getOrCreateWallet(req.user.id);
            const reference = `TOPUP:${wallet.id}:SIM:${Date.now()}`;
            const credited = await creditWalletIfNotProcessed({
                wallet,
                userId: req.user.id,
                amount: topupAmount,
                reference,
                transactionId: `SIM_${Date.now()}`,
            });

            return res.json({
                success: true,
                message: credited.alreadyProcessed
                    ? "Topup already simulated"
                    : "Wallet topped up successfully (SIMULATED)",
                data: {
                    newBalance: credited.balance,
                    topupAmount: credited.amount,
                    transactionId: credited.transactionId,
                    simulated: true,
                },
            });
        }

        return res.status(400).json({
            success: false,
            message:
                "Missing charge data. Send card fields for direct charge, or signed PaySky fields for confirmation.",
        });
    } catch (error) {
        console.error("Wallet topup error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Legacy wrapper -> unified wallet top-up handler
// @route   POST /apimobile/driver/wallet/topup
// @access  Private (Driver)
export const initWalletTopup = async (req, res) => {
    return topupWallet(req, res);
};

// @desc    Legacy wrapper -> unified wallet top-up handler
// @route   POST /apimobile/driver/wallet/topup
// @access  Private (Driver)
export const payWalletTopupWithCard = async (req, res) => {
    return topupWallet(req, res);
};

// @desc    Legacy wrapper -> unified wallet top-up handler
// @route   POST /apimobile/driver/wallet/topup
// @access  Private (Driver)
export const confirmWalletTopup = async (req, res) => {
    return topupWallet(req, res);
};

// @desc    Legacy wrapper -> unified wallet top-up handler (simulate=true)
// @route   POST /apimobile/driver/wallet/topup
// @access  Private (Driver)
export const simulateWalletTopup = async (req, res) => {
    req.body = { ...req.body, simulate: true };
    return topupWallet(req, res);
};

// @desc    Get wallet balance and info
// @route   GET /apimobile/driver/wallet/balance
// @access  Private (Driver)
export const getWalletBalance = async (req, res) => {
    try {
        let wallet = await prisma.wallet.findUnique({
            where: { userId: req.user.id },
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    userId: req.user.id,
                    balance: 0,
                },
            });
        }

        res.json({
            success: true,
            data: {
                id: wallet.id,
                balance: wallet.balance,
                currency: wallet.currency,
                updatedAt: wallet.updatedAt,
            },
        });
    } catch (error) {
        console.error("Get wallet balance error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
