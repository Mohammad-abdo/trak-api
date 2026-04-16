import prisma from "../../utils/prisma.js";
import { userHasAnyPermission } from "../../utils/staffPermissions.js";

// @desc    Save wallet (add money)
// @route   POST /api/wallets/save-wallet
// @access  Private
export const saveWallet = async (req, res) => {
    try {
        const isAdmin = req.user?.userType === "admin";
        const isSubAdminWithWalletManage =
            req.user?.userType === "sub_admin" &&
            (await userHasAnyPermission(req.user.id, req.user.userType, ["wallets.manage"]));

        if (!isAdmin && !isSubAdminWithWalletManage) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Insufficient permissions for this resource.",
            });
        }

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
