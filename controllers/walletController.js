import prisma from "../utils/prisma.js";
import { getDriverAndSystemShare, getDriverAndSystemShareWithPct } from "../utils/settingsHelper.js";

// @desc    Get wallet detail
// @route   GET /api/wallets/wallet-detail
// @access  Private
export const getWalletDetail = async (req, res) => {
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
            data: wallet,
        });
    } catch (error) {
        console.error("Get wallet detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save wallet (add money)
// @route   POST /api/wallets/save-wallet
// @access  Private
export const saveWallet = async (req, res) => {
    try {
        const { amount } = req.body;

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

        const newBalance = wallet.balance + amount;

        wallet = await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
        });

        await prisma.walletHistory.create({
            data: {
                walletId: wallet.id,
                userId: req.user.id,
                type: "credit",
                amount,
                balance: newBalance,
                description: "Wallet top-up",
                transactionType: "admin_adjustment",
            },
        });

        res.json({
            success: true,
            message: "Wallet updated successfully",
            data: wallet,
        });
    } catch (error) {
        console.error("Save wallet error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get wallet history list
// @route   GET /api/wallets/wallet-list
// @access  Private
export const getWalletList = async (req, res) => {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.user.id },
        });

        if (!wallet) {
            return res.json({
                success: true,
                data: [],
            });
        }

        const history = await prisma.walletHistory.findMany({
            where: { walletId: wallet.id },
            include: {
                rideRequest: {
                    select: {
                        id: true,
                        startAddress: true,
                        endAddress: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        console.error("Get wallet list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get all wallets (Admin) — drivers only, with filters
// @route   GET /api/wallets
// @access  Private (Admin)
export const getAllWallets = async (req, res) => {
    try {
        const { search, minBalance, maxBalance, balanceFilter, sortBy = "updatedAt", sortOrder = "desc" } = req.query;

        const where = {
            user: { userType: "driver" },
        };

        if (search && String(search).trim()) {
            const term = String(search).trim();
            where.user.OR = [
                { firstName: { contains: term } },
                { lastName: { contains: term } },
                { email: { contains: term } },
            ];
        }

        if (balanceFilter === "zero") {
            where.balance = 0;
        } else if (balanceFilter === "positive" || minBalance != null || maxBalance != null) {
            const bal = {};
            if (balanceFilter === "positive" || minBalance != null) {
                bal.gte = minBalance != null && minBalance !== "" ? parseFloat(minBalance) : 0.01;
            }
            if (maxBalance != null && maxBalance !== "") {
                const max = parseFloat(maxBalance);
                if (!Number.isNaN(max)) bal.lte = max;
            }
            if (Object.keys(bal).length) where.balance = bal;
        }

        const orderField = sortBy === "balance" ? "balance" : "updatedAt";
        const order = sortOrder === "asc" ? "asc" : "desc";

        const wallets = await prisma.wallet.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        userType: true,
                    },
                },
            },
            orderBy: { [orderField]: order },
        });

        res.json({
            success: true,
            data: wallets,
        });
    } catch (error) {
        console.error("Get all wallets error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get single wallet by ID (Admin) — drivers only
// @route   GET /api/wallets/:id
// @access  Private (Admin)
export const getWalletByIdForAdmin = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid wallet id" });
        }
        const wallet = await prisma.wallet.findFirst({
            where: {
                id,
                user: { userType: "driver" },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        userType: true,
                        contactNumber: true,
                    },
                },
            },
        });
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }
        const [commissionRow, commissionDebitSum, commissionCreditSum, withdrawalSum, rideEarningsHistory] = await Promise.all([
            prisma.setting.findUnique({ where: { key: "system_commission_percentage" } }),
            prisma.walletHistory.aggregate({
                where: {
                    walletId: wallet.id,
                    type: "debit",
                    transactionType: { in: ["system_commission_cash", "system_commission_correction"] },
                },
                _sum: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: {
                    walletId: wallet.id,
                    type: "credit",
                    transactionType: "system_commission_correction",
                },
                _sum: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: {
                    walletId: wallet.id,
                    type: "debit",
                    transactionType: "withdrawal",
                },
                _sum: { amount: true },
            }),
            prisma.walletHistory.findMany({
                where: {
                    walletId: wallet.id,
                    type: "credit",
                    transactionType: "ride_earnings",
                },
                include: { rideRequest: { select: { totalAmount: true } } },
            }),
        ]);
        const systemCommissionPercentage = Math.min(100, Math.max(0, parseFloat(commissionRow?.value) || 15));
        const commissionDebits = Math.round(Number(commissionDebitSum._sum?.amount ?? 0) * 100) / 100;
        const commissionRefunds = Math.round(Number(commissionCreditSum._sum?.amount ?? 0) * 100) / 100;
        const fromCash = Math.round((commissionDebits - commissionRefunds) * 100) / 100;
        const fromCardRides = Math.round(rideEarningsHistory.reduce((sum, h) => {
            const total = parseFloat(h.rideRequest?.totalAmount ?? 0) || 0;
            const net = parseFloat(h.amount ?? 0) || 0;
            if (total > 0 && net >= 0) return sum + (total - net);
            return sum;
        }, 0) * 100) / 100;
        const totalSystemCommissionDeducted = Math.round((fromCash + fromCardRides) * 100) / 100;
        const totalWithdrawn = Math.round(Number(withdrawalSum._sum?.amount ?? 0) * 100) / 100;
        const totalEarningsFromRides = Math.round(rideEarningsHistory.reduce((sum, h) => sum + (parseFloat(h.amount ?? 0) || 0), 0) * 100) / 100;
        const balanceValue = Math.round((parseFloat(wallet.balance) ?? 0) * 100) / 100;
        res.json({
            success: true,
            data: {
                ...wallet,
                balance: balanceValue,
                systemCommissionPercentage,
                totalSystemCommissionDeducted,
                totalWithdrawn,
                totalEarningsFromRides,
                balanceFormula: "balance = sum of all transaction effects (credits - debits). Commission is deducted as fixed EGP per order only; no percentage is applied to wallet balance.",
            },
        });
    } catch (error) {
        console.error("Get wallet by id error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get wallet history for admin (driver wallet)
// @route   GET /api/wallets/:id/history
// @access  Private (Admin)
export const getWalletHistoryForAdmin = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
        const offset = parseInt(req.query.offset, 10) || 0;
        if (Number.isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid wallet id" });
        }
        const wallet = await prisma.wallet.findFirst({
            where: {
                id,
                user: { userType: "driver" },
            },
        });
        if (!wallet) {
            return res.status(404).json({ success: false, message: "Wallet not found" });
        }
        const [history, total] = await Promise.all([
            prisma.walletHistory.findMany({
                where: { walletId: id },
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: offset,
                include: {
                    rideRequest: { select: { totalAmount: true } },
                },
            }),
            prisma.walletHistory.count({ where: { walletId: id } }),
        ]);
        res.json({ success: true, data: history, total });
    } catch (error) {
        console.error("Get wallet history error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add/Subtract wallet transaction (Admin)
// @route   POST /api/wallets/:id/transaction
// @access  Private (Admin)
export const addWalletTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, type, description } = req.body; // type: credit or debit

        const wallet = await prisma.wallet.findUnique({
            where: { id: parseInt(id) },
        });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                message: "Wallet not found",
            });
        }

        const amountNum = parseFloat(amount);
        let newBalance = wallet.balance;

        if (type === "credit") {
            newBalance = wallet.balance + amountNum;
        } else if (type === "debit") {
            if (wallet.balance < amountNum) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient balance",
                });
            }
            newBalance = wallet.balance - amountNum;
        }

        const updatedWallet = await prisma.wallet.update({
            where: { id: parseInt(id) },
            data: { balance: newBalance },
        });

        await prisma.walletHistory.create({
            data: {
                walletId: wallet.id,
                userId: wallet.userId,
                type,
                amount: amountNum,
                balance: newBalance,
                description: description || `Admin ${type}`,
                transactionType: "admin_adjustment",
            },
        });

        res.json({
            success: true,
            message: "Wallet transaction completed",
            data: updatedWallet,
        });
    } catch (error) {
        console.error("Add wallet transaction error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Add funds to user wallet by user ID (Admin)
// @route   POST /api/wallets/user/:userId/fund
// @access  Private (Admin)
export const addFundsToUserWallet = async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, description } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid amount",
            });
        }

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Get or create wallet
        let wallet = await prisma.wallet.findUnique({
            where: { userId: parseInt(userId) },
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    userId: parseInt(userId),
                    balance: 0,
                },
            });
        }

        const amountNum = parseFloat(amount);
        const newBalance = wallet.balance + amountNum;

        // Update wallet
        const updatedWallet = await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: newBalance },
        });

        // Create wallet history
        await prisma.walletHistory.create({
            data: {
                walletId: wallet.id,
                userId: parseInt(userId),
                type: "credit",
                amount: amountNum,
                balance: newBalance,
                description: description || "Admin fund addition",
                transactionType: "admin_adjustment",
            },
        });

        res.json({
            success: true,
            message: `Successfully added ${amountNum} to user wallet`,
            data: {
                wallet: updatedWallet,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                },
            },
        });
    } catch (error) {
        console.error("Add funds to user wallet error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Backfill driver wallet history from existing paid payments (مرة واحدة لتعويض أرباح سابقة)
// @route   POST /api/wallets/backfill-driver-earnings
// @access  Private (Admin)
export const backfillDriverEarnings = async (req, res) => {
    try {
        const paidPayments = await prisma.payment.findMany({
            where: { paymentStatus: "paid" },
            include: { rideRequest: { select: { id: true, totalAmount: true } } },
        });
        let created = 0;
        for (const p of paidPayments) {
            const driverId = p.driverId;
            const rideTotal = p.amount || p.rideRequest?.totalAmount;
            if (!driverId || !rideTotal || rideTotal <= 0) continue;
            const existing = await prisma.walletHistory.findFirst({
                where: {
                    rideRequestId: p.rideRequestId,
                    userId: driverId,
                    type: "credit",
                    transactionType: "ride_earnings",
                },
            });
            if (existing) continue;
            const { driverShare } = await getDriverAndSystemShare(rideTotal);
            let driverWallet = await prisma.wallet.findUnique({
                where: { userId: driverId },
            });
            if (!driverWallet) {
                driverWallet = await prisma.wallet.create({
                    data: { userId: driverId, balance: 0 },
                });
            }
            const currentBalance = parseFloat(driverWallet.balance) || 0;
            const newBalance = Math.round((currentBalance + driverShare) * 100) / 100;
            await prisma.wallet.update({
                where: { id: driverWallet.id },
                data: { balance: newBalance },
            });
            await prisma.walletHistory.create({
                data: {
                    walletId: driverWallet.id,
                    userId: driverId,
                    type: "credit",
                    amount: driverShare,
                    balance: newBalance,
                    description: "Ride earnings (backfill, after system share)",
                    transactionType: "ride_earnings",
                    rideRequestId: p.rideRequestId,
                },
            });
            created++;
        }
        res.json({
            success: true,
            message: `Backfill complete. Created ${created} driver earnings entries.`,
            data: { created, totalPaidPayments: paidPayments.length },
        });
    } catch (error) {
        console.error("Backfill driver earnings error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    تصحيح نسبة السستم على أرباح سُجّلت بالمبلغ الكامل (مرة واحدة)
// @route   POST /api/wallets/fix-commission-on-earnings
// @access  Private (Admin)
export const fixCommissionOnRideEarnings = async (req, res) => {
    try {
        const histories = await prisma.walletHistory.findMany({
            where: { type: "credit", transactionType: "ride_earnings" },
            include: { rideRequest: { select: { id: true, totalAmount: true } } },
        });
        let corrected = 0;
        for (const h of histories) {
            const total = parseFloat(h.rideRequest?.totalAmount ?? 0) || 0;
            const credited = parseFloat(h.amount ?? 0) || 0;
            if (total <= 0 || credited <= 0) continue;
            const { driverShare } = await getDriverAndSystemShare(total);
            const diff = Math.round((credited - driverShare) * 100) / 100;
            if (diff <= 0) continue;
            const wallet = await prisma.wallet.findUnique({ where: { id: h.walletId } });
            if (!wallet) continue;
            const currentBalance = parseFloat(wallet.balance) || 0;
            const newBalance = Math.round((currentBalance - diff) * 100) / 100;
            await prisma.$transaction([
                prisma.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: newBalance },
                }),
                prisma.walletHistory.create({
                    data: {
                        walletId: wallet.id,
                        userId: h.userId,
                        type: "debit",
                        amount: diff,
                        balance: newBalance,
                        description: `Commission correction (ride #${h.rideRequestId})`,
                        transactionType: "system_commission_correction",
                        rideRequestId: h.rideRequestId,
                    },
                }),
            ]);
            corrected++;
        }
        res.json({
            success: true,
            message: corrected
                ? `Corrected ${corrected} ride earnings (commission deducted).`
                : "No ride earnings needed correction.",
            data: { corrected, totalChecked: histories.length },
        });
    } catch (error) {
        console.error("Fix commission on earnings error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * إعادة حساب كل المحافظ عند تغيير نسبة السستم في الإعدادات.
 * يُنشئ معاملات تصحيح (system_commission_correction) ويحدّث الأرصدة.
 * @param {number} newPct - النسبة الجديدة 0–100
 * @returns {{ rideEarningsCorrected: number, cashCommissionCorrected: number }}
 */
export async function recalculateWalletsForNewCommissionPercentage(newPct) {
    const pct = Math.min(100, Math.max(0, parseFloat(newPct) || 0));
    let rideEarningsCorrected = 0;
    let cashCommissionCorrected = 0;

    // 1) رحلات كارد/محفظة: تم إيداع صافي السائق — نصحح حسب النسبة الجديدة
    const rideEarningsHistories = await prisma.walletHistory.findMany({
        where: { type: "credit", transactionType: "ride_earnings" },
        include: { rideRequest: { select: { id: true, totalAmount: true } } },
    });
    for (const h of rideEarningsHistories) {
        const total = parseFloat(h.rideRequest?.totalAmount ?? 0) || 0;
        if (total <= 0) continue;
        const currentCredited = parseFloat(h.amount ?? 0) || 0;
        const { driverShare: newDriverShare } = getDriverAndSystemShareWithPct(total, pct);
        const diff = Math.round((newDriverShare - currentCredited) * 100) / 100;
        if (diff === 0) continue;
        const wallet = await prisma.wallet.findUnique({ where: { id: h.walletId } });
        if (!wallet) continue;
        const currentBalance = parseFloat(wallet.balance) || 0;
        const newBalance = Math.round((currentBalance + diff) * 100) / 100;
        await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance },
            }),
            prisma.walletHistory.create({
                data: {
                    walletId: wallet.id,
                    userId: h.userId,
                    type: diff > 0 ? "credit" : "debit",
                    amount: Math.abs(diff),
                    balance: newBalance,
                    description: `Commission % updated to ${pct}% (ride #${h.rideRequestId})`,
                    transactionType: "system_commission_correction",
                    rideRequestId: h.rideRequestId,
                },
            }),
        ]);
        rideEarningsCorrected++;
    }

    // 2) رحلات كاش: تم خصم نسبة السستم — نصحح حسب النسبة الجديدة
    const cashCommissionHistories = await prisma.walletHistory.findMany({
        where: { type: "debit", transactionType: "system_commission_cash" },
        include: { rideRequest: { select: { id: true, totalAmount: true } } },
    });
    for (const h of cashCommissionHistories) {
        const total = parseFloat(h.rideRequest?.totalAmount ?? 0) || 0;
        if (total <= 0) continue;
        const currentDebited = parseFloat(h.amount ?? 0) || 0;
        const { systemShare: newSystemShare } = getDriverAndSystemShareWithPct(total, pct);
        const diff = Math.round((newSystemShare - currentDebited) * 100) / 100;
        if (diff === 0) continue;
        const wallet = await prisma.wallet.findUnique({ where: { id: h.walletId } });
        if (!wallet) continue;
        const currentBalance = parseFloat(wallet.balance) || 0;
        const newBalance = Math.round((currentBalance - diff) * 100) / 100;
        await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance },
            }),
            prisma.walletHistory.create({
                data: {
                    walletId: wallet.id,
                    userId: h.userId,
                    type: diff > 0 ? "debit" : "credit",
                    amount: Math.abs(diff),
                    balance: newBalance,
                    description: `Commission % updated to ${pct}% (ride #${h.rideRequestId})`,
                    transactionType: "system_commission_correction",
                    rideRequestId: h.rideRequestId,
                },
            }),
        ]);
        cashCommissionCorrected++;
    }

    return { rideEarningsCorrected, cashCommissionCorrected };
}

// @desc    Get reward history
// @route   GET /api/wallets/reward-list
// @access  Private
export const getRewardList = async (req, res) => {
    try {
        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.user.id },
        });

        if (!wallet) {
            return res.json({
                success: true,
                data: [],
            });
        }

        const rewards = await prisma.walletHistory.findMany({
            where: {
                walletId: wallet.id,
                transactionType: "reward",
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: rewards,
        });
    } catch (error) {
        console.error("Get reward list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
