import prisma from "../../utils/prisma.js";
import crypto from "crypto";
import { isPayskyConfigured, getPayskyEnv } from "../../utils/payskyApi.js";
import { processPayskyCardPayment } from "../../utils/payskyCardPayment.js";

// @desc    Get wallet top-up config (for Paysky VPOS)
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

        const merchantId = process.env.PAYSKY_MERCHANT_ID.trim();
        const terminalId = process.env.PAYSKY_TERMINAL_ID.trim();
        const secretKey = process.env.PAYSKY_SECRET_KEY_HEX.trim();
        const currency = process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC?.trim() || "818";
        const env = getPayskyEnv();

        // Amount in minor units (halalas for EGP)
        const amountMinor = Math.round(topupAmount * 100);
        const datetime = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
        const merchantReference = `TOPUP:${wallet.id}:${Date.now()}`;

        // Build secure hash for VPOS
        const pairs = [
            ["Amount", String(amountMinor)],
            ["DateTimeLocalTrxn", String(datetime)],
            ["MerchantId", String(merchantId)],
            ["MerchantReference", String(merchantReference)],
            ["TerminalId", String(terminalId)],
        ];
        pairs.sort((a, b) => a[0].localeCompare(b[0]));
        const canonical = pairs.map(([k, v]) => `${k}=${v}`).join("&");
        const key = Buffer.from(secretKey.replace(/\s+/g, ""), "hex");
        const secureHash = crypto.createHmac("sha256", key).update(canonical, "utf8").digest("hex").toUpperCase();

        // VPOS Payment Page URL
        const vposUrl = `${env.API_BASE}/PaymentRequest/Pay`;

        res.json({
            success: true,
            data: {
                merchantReference: merchantReference,
                topupAmount: topupAmount,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                environment: process.env.NODE_ENV === "production" ? "production" : "test",
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

// @desc    Pay wallet top-up with card details (direct Paysky API)
// @route   POST /apimobile/driver/wallet/topup/pay
// @access  Private (Driver)
export const payWalletTopupWithCard = async (req, res) => {
    try {
        const { amount, cardNumber, expiryMonth, expiryYear, cvv, cardHolderName, merchantReference } = req.body;
        const topupAmount = parseFloat(amount);

        if (!topupAmount || isNaN(topupAmount) || topupAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount",
            });
        }

        if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardHolderName) {
            return res.status(400).json({
                success: false,
                message: "Card details are required",
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

        // Generate merchant reference if not provided
        const ref = merchantReference || `TOPUP:${wallet.id}:${Date.now()}`;

        // Process payment with Paysky
        const paymentResult = await processPayskyCardPayment({
            amount: topupAmount,
            cardNumber: cardNumber,
            expiryMonth: expiryMonth,
            expiryYear: expiryYear,
            cvv: cvv,
            cardHolderName: cardHolderName,
            merchantReference: ref,
            userId: req.user.id,
        });

        if (!paymentResult.success) {
            return res.json({
                success: false,
                message: paymentResult.message || "Payment failed",
                responseCode: paymentResult.responseCode,
            });
        }

        // Check if already credited (idempotency)
        const existingTopup = await prisma.walletHistory.findFirst({
            where: {
                walletId: wallet.id,
                transactionType: "topup",
                description: ref,
            },
        });

        if (existingTopup) {
            return res.json({
                success: true,
                message: "Topup already processed",
                data: {
                    newBalance: wallet.balance,
                    topupAmount: topupAmount,
                    transactionId: paymentResult.systemReference,
                },
            });
        }

        // Credit wallet
        const newBalance = wallet.balance + topupAmount;

        const [updatedWallet, history] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance },
            }),
            prisma.walletHistory.create({
                data: {
                    walletId: wallet.id,
                    userId: req.user.id,
                    type: "credit",
                    amount: topupAmount,
                    balance: newBalance,
                    description: ref,
                    transactionType: "topup",
                },
            }),
        ]);

        res.json({
            success: true,
            message: "Wallet topped up successfully",
            data: {
                newBalance: updatedWallet.balance,
                topupAmount: topupAmount,
                transactionId: paymentResult.systemReference,
            },
        });
    } catch (error) {
        console.error("Pay wallet topup with card error:", error);
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

        if (!topupAmount || isNaN(topupAmount) || topupAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount",
            });
        }

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
                    topupAmount: topupAmount,
                },
            });
        }

        // Add balance to wallet
        const newBalance = wallet.balance + topupAmount;

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
                    amount: topupAmount,
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
                topupAmount: topupAmount,
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

// @desc    SIMULATE wallet top-up (for testing without real Paysky)
// @route   POST /apimobile/driver/wallet/topup/simulate
// @access  Private (Driver)
export const simulateWalletTopup = async (req, res) => {
    try {
        const { amount } = req.body;
        const topupAmount = parseFloat(amount);

        if (!topupAmount || isNaN(topupAmount) || topupAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount. Amount must be a positive number.",
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

        // Generate mock merchant reference
        const mockMerchantRef = `TOPUP:${wallet.id}:${Date.now()}`;
        const mockTransactionId = `SIM_${Date.now()}`;

        // Check if this simulation was already processed
        const existingTopup = await prisma.walletHistory.findFirst({
            where: {
                walletId: wallet.id,
                transactionType: "topup",
                description: mockMerchantRef,
            },
        });

        if (existingTopup) {
            return res.json({
                success: true,
                message: "Topup already simulated",
                data: {
                    newBalance: wallet.balance,
                    topupAmount: topupAmount,
                    transactionId: mockTransactionId,
                    simulated: true,
                },
            });
        }

        // Add balance to wallet
        const newBalance = wallet.balance + topupAmount;

        const [updatedWallet, history] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance },
            }),
            prisma.walletHistory.create({
                data: {
                    walletId: wallet.id,
                    userId: req.user.id,
                    type: "credit",
                    amount: topupAmount,
                    balance: newBalance,
                    description: mockMerchantRef,
                    transactionType: "topup",
                },
            }),
        ]);

        res.json({
            success: true,
            message: "Wallet topped up successfully (SIMULATED)",
            data: {
                newBalance: updatedWallet.balance,
                topupAmount: topupAmount,
                transactionId: mockTransactionId,
                simulated: true,
                note: "This is a simulation - no real payment was made",
            },
        });
    } catch (error) {
        console.error("Simulate wallet topup error:", error);
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
