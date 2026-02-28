import prisma from "../utils/prisma.js";
import { getDriverAndSystemShare } from "../utils/settingsHelper.js";

// @desc    Get payment list
// @route   GET /api/payments
// @access  Private (Admin)
export const getPaymentList = async (req, res) => {
    try {
        const { payment_type, payment_status, from_date, to_date } = req.query;
        const where = {};

        if (payment_type && payment_type !== 'all') {
            where.paymentType = payment_type;
        }

        if (payment_status) {
            where.paymentStatus = payment_status;
        }

        if (from_date || to_date) {
            where.createdAt = {};
            if (from_date) where.createdAt.gte = new Date(from_date);
            if (to_date) where.createdAt.lte = new Date(to_date);
        }

        const payments = await prisma.payment.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                rideRequest: {
                    select: {
                        id: true,
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: payments,
        });
    } catch (error) {
        console.error("Get payment list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save payment
// @route   POST /api/payments/save-payment
// @access  Private
export const savePayment = async (req, res) => {
    try {
        const { rideRequestId, paymentType, transactionId } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        // Create or update payment
        let payment = await prisma.payment.findFirst({
            where: { rideRequestId },
        });

        if (payment) {
            payment = await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    paymentType,
                    paymentStatus: "paid",
                    transactionId,
                },
            });
        } else {
            payment = await prisma.payment.create({
                data: {
                    rideRequestId: rideRequest.id,
                    userId: rideRequest.riderId,
                    driverId: rideRequest.driverId,
                    amount: rideRequest.totalAmount,
                    paymentType,
                    paymentStatus: "paid",
                    transactionId,
                },
            });
        }

        // If wallet payment, deduct from rider wallet
        if (paymentType === "wallet") {
            const wallet = await prisma.wallet.findUnique({
                where: { userId: rideRequest.riderId },
            });

            if (wallet && wallet.balance >= rideRequest.totalAmount) {
                const newBalance = wallet.balance - rideRequest.totalAmount;

                await prisma.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: newBalance },
                });

                await prisma.walletHistory.create({
                    data: {
                        walletId: wallet.id,
                        userId: rideRequest.riderId,
                        type: "debit",
                        amount: rideRequest.totalAmount,
                        balance: newBalance,
                        description: "Ride payment",
                        transactionType: "ride_payment",
                        rideRequestId: rideRequest.id,
                    },
                });
            }
        }

        // Credit driver wallet (صافي أرباح الرحلة بعد نسبة السستم) — once per payment
        const rideTotal = rideRequest.totalAmount || payment.amount;
        const driverId = rideRequest.driverId;
        if (driverId && rideTotal > 0) {
            const alreadyCredited = await prisma.walletHistory.findFirst({
                where: {
                    rideRequestId: rideRequest.id,
                    userId: driverId,
                    type: "credit",
                    transactionType: "ride_earnings",
                },
            });
            if (!alreadyCredited) {
                const { driverShare } = await getDriverAndSystemShare(rideTotal);
                let driverWallet = await prisma.wallet.findUnique({
                    where: { userId: driverId },
                });
                if (!driverWallet) {
                    driverWallet = await prisma.wallet.create({
                        data: { userId: driverId, balance: 0 },
                    });
                }
                const newDriverBalance = driverWallet.balance + driverShare;
                await prisma.wallet.update({
                    where: { id: driverWallet.id },
                    data: { balance: newDriverBalance },
                });
                await prisma.walletHistory.create({
                    data: {
                        walletId: driverWallet.id,
                        userId: driverId,
                        type: "credit",
                        amount: driverShare,
                        balance: newDriverBalance,
                        description: "Ride earnings (after system share)",
                        transactionType: "ride_earnings",
                        rideRequestId: rideRequest.id,
                    },
                });
            }
        }

        res.json({
            success: true,
            message: "Payment saved successfully",
            data: payment,
        });
    } catch (error) {
        console.error("Save payment error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get driver earnings list
// @route   POST /api/payments/earning-list
// @access  Private
export const driverEarningList = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        const where = {
            driverId: req.user.id,
            paymentStatus: "paid",
        };

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        const payments = await prisma.payment.findMany({
            where,
            include: {
                rideRequest: {
                    select: {
                        id: true,
                        startAddress: true,
                        endAddress: true,
                        totalAmount: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const totalEarnings = payments.reduce(
            (sum, payment) => sum + payment.amount,
            0
        );

        res.json({
            success: true,
            data: {
                payments,
                totalEarnings,
                totalRides: payments.length,
            },
        });
    } catch (error) {
        console.error("Driver earning list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
