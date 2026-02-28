import prisma from "../utils/prisma.js";

// @desc    Get withdraw request list (admin: drivers only; user: own only)
// @route   GET /api/withdraw-requests/withdrawrequest-list
// @access  Private
export const getWithdrawRequestList = async (req, res) => {
    try {
        const where = {};

        if (req.user.userType === "admin") {
            where.user = { userType: "driver" };
            if (req.query.userId) {
                const uid = parseInt(req.query.userId, 10);
                if (!Number.isNaN(uid)) where.userId = uid;
            }
        } else {
            where.userId = req.user.id;
        }

        const withdrawRequests = await prisma.withdrawRequest.findMany({
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
            orderBy: { createdAt: "desc" },
        });

        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.user.id },
        });

        res.json({
            success: true,
            data: withdrawRequests,
            walletBalance: wallet || { balance: 0 },
        });
    } catch (error) {
        console.error("Get withdraw request list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save withdraw request
// @route   POST /api/withdraw-requests/save-withdrawrequest
// @access  Private
export const saveWithdrawRequest = async (req, res) => {
    try {
        const { amount, currency = "USD" } = req.body;

        // Check wallet balance
        const wallet = await prisma.wallet.findUnique({
            where: { userId: req.user.id },
        });

        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient wallet balance",
            });
        }

        const withdrawRequest = await prisma.withdrawRequest.create({
            data: {
                userId: req.user.id,
                amount,
                currency,
                status: 0, // Pending
            },
        });

        res.json({
            success: true,
            message: "Withdraw request created successfully",
            data: withdrawRequest,
        });
    } catch (error) {
        console.error("Save withdraw request error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update withdraw request
// @route   PUT /api/withdraw-requests/:id
// @access  Private (Admin)
export const updateWithdrawRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, currency } = req.body;

        const updateData = {};
        if (amount !== undefined) updateData.amount = parseFloat(amount);
        if (currency !== undefined) updateData.currency = currency;

        const withdrawRequest = await prisma.withdrawRequest.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            message: "Withdraw request updated successfully",
            data: withdrawRequest,
        });
    } catch (error) {
        console.error("Update withdraw request error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Withdraw request not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete withdraw request
// @route   DELETE /api/withdraw-requests/:id
// @access  Private (Admin)
export const deleteWithdrawRequest = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.withdrawRequest.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Withdraw request deleted successfully",
        });
    } catch (error) {
        console.error("Delete withdraw request error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Withdraw request not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update withdraw request status
// @route   POST /api/withdraw-requests/update-status/:id
// @access  Private
export const updateWithdrawRequestStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const withdrawRequest = await prisma.withdrawRequest.findUnique({
            where: { id: parseInt(id) },
        });

        if (!withdrawRequest) {
            return res.status(404).json({
                success: false,
                message: "Withdraw request not found",
            });
        }

        // If approved, deduct from wallet
        if (status === 1 && withdrawRequest.status === 0) {
            const wallet = await prisma.wallet.findUnique({
                where: { userId: withdrawRequest.userId },
            });

            if (wallet && wallet.balance >= withdrawRequest.amount) {
                await prisma.wallet.update({
                    where: { id: wallet.id },
                    data: {
                        balance: wallet.balance - withdrawRequest.amount,
                    },
                });

                await prisma.walletHistory.create({
                    data: {
                        walletId: wallet.id,
                        userId: withdrawRequest.userId,
                        type: "debit",
                        amount: withdrawRequest.amount,
                        balance: wallet.balance - withdrawRequest.amount,
                        description: "Withdrawal",
                        transactionType: "withdrawal",
                    },
                });
            }
        }

        const updatedRequest = await prisma.withdrawRequest.update({
            where: { id: parseInt(id) },
            data: { status: parseInt(status) },
        });

        res.json({
            success: true,
            message: "Withdraw request status updated successfully",
            data: updatedRequest,
        });
    } catch (error) {
        console.error("Update withdraw request status error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


