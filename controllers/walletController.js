import prisma from "../utils/prisma.js";

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
        res.json({ success: true, data: wallet });
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
