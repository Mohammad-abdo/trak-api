import prisma from "../../utils/prisma.js";
import { isPayskyConfigured, generatePayskyPaymentConfig, getAmountMinorUnit, getPayskyEnv } from "../../utils/payskyApi.js";

// @desc    Get wallet top-up config (for Paysky payment)
// @route   POST /apimobile/driver/wallet/topup/init
// @access  Private (Driver)
export const initWalletTopup = async (req, res) => {
    try {
        const { amount } = req.body;
        const topupAmount = parseFloat(amount);

        if (!topupAmount || isNaN(topupAmount) || topupAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount. Amount must be a positive number.",
            });
        }

        if (!isPayskyConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Payment service is not configured on this server",
            });
        }

        // Get or create wallet
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

        const amountMinor = getAmountMinorUnit(topupAmount);
        const merchantReference = `TOPUP:${wallet.id}:${Date.now()}`;

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
                topupAmount: topupAmount,
            },
        });
    } catch (error) {
        console.error("Init wallet topup error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Confirm wallet top-up after successful Paysky payment
// @route   POST /apimobile/driver/wallet/topup/confirm
// @access  Private (Driver)
export const confirmWalletTopup = async (req, res) => {
    try {
        const { merchantReference, systemReference, amount, paidThrough } = req.body;

        // Parse merchantReference: TOPUP:{walletId}:{timestamp}
        if (!merchantReference || !merchantReference.startsWith("TOPUP:")) {
            return res.status(400).json({
                success: false,
                message: "Invalid merchant reference",
            });
        }

        const parts = merchantReference.split(":");
        if (parts.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Invalid merchant reference format",
            });
        }

        const walletId = parseInt(parts[1]);
        const topupAmount = parseFloat(amount);

        // Verify the wallet belongs to the user
        const wallet = await prisma.wallet.findFirst({
            where: { id: walletId, userId: req.user.id },
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found",
            });
        }

        // Check if this topup was already processed (idempotency)
        const existingTopup = await prisma.walletHistory.findFirst({
            where: {
                walletId,
                transactionType: "topup",
                description: merchantReference,
            },
        });

        if (existingTopup) {
            return res.json({
                success: true,
                message: "Topup already processed",
                data: {
                    newBalance: wallet.balance,
                    topupAmount: topupAmount / 100,
                },
            });
        }

        // Add balance to wallet
        const amountMajor = topupAmount / 100;
        const newBalance = wallet.balance + amountMajor;

        const [updatedWallet, history] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: walletId },
                data: { balance: newBalance },
            }),
            prisma.walletHistory.create({
                data: {
                    walletId,
                    userId: req.user.id,
                    type: "credit",
                    amount: amountMajor,
                    balance: newBalance,
                    description: merchantReference,
                    transactionType: "topup",
                },
            }),
        ]);

        res.json({
            success: true,
            message: "Wallet topped up successfully",
            data: {
                newBalance: updatedWallet.balance,
                topupAmount: amountMajor,
                transactionId: systemReference || null,
            },
        });
    } catch (error) {
        console.error("Confirm wallet topup error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
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
