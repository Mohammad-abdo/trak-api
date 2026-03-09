import prisma from "../../utils/prisma.js";

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
        const [commissionRow, withdrawalSum, rideEarningsHistory, otherCreditsSum, otherDebitsSum] = await Promise.all([
            prisma.setting.findUnique({ where: { key: "system_commission_percentage" } }),
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
                select: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: {
                    walletId: wallet.id,
                    type: "credit",
                    transactionType: { notIn: ["ride_earnings"] },
                },
                _sum: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: {
                    walletId: wallet.id,
                    type: "debit",
                    transactionType: { notIn: ["withdrawal"] },
                },
                _sum: { amount: true },
            }),
        ]);
        const systemCommissionPercentage = Math.min(100, Math.max(0, parseFloat(commissionRow?.value) || 15));
        const totalEarningsFromRides = Math.round(rideEarningsHistory.reduce((sum, h) => sum + (parseFloat(h.amount ?? 0) || 0), 0) * 100) / 100;
        const totalSystemCommissionDeducted = Math.round((totalEarningsFromRides * systemCommissionPercentage) / 100 * 100) / 100;
        const totalWithdrawn = Math.round(Number(withdrawalSum._sum?.amount ?? 0) * 100) / 100;
        const otherCredits = Math.round(Number(otherCreditsSum._sum?.amount ?? 0) * 100) / 100;
        const otherDebits = Math.round(Number(otherDebitsSum._sum?.amount ?? 0) * 100) / 100;
        const balanceValue = Math.round((totalEarningsFromRides * (1 - systemCommissionPercentage / 100) - totalWithdrawn + otherCredits - otherDebits) * 100) / 100;
        res.json({
            success: true,
            data: {
                ...wallet,
                balance: balanceValue,
                systemCommissionPercentage,
                totalSystemCommissionDeducted,
                totalWithdrawn,
                totalEarningsFromRides,
                balanceFormula: "balance = totalEarningsFromRides × (1 − commission%) − totalWithdrawn + otherCredits − otherDebits. Commission is applied once on total wallet earnings (from settings).",
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
