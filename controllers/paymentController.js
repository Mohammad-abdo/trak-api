import prisma from "../utils/prisma.js";
import { parseRideRequestIdParam } from "../utils/rideRequestId.js";
import { debitWalletForRideIfSufficient } from "../services/walletLedgerService.js";
import { userHasAnyPermission } from "../utils/staffPermissions.js";
import {
    completePaidGatewayPayment,
    getEffectiveRidePaymentTotal,
} from "../services/ridePaymentCompletionService.js";

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
        const rideId = parseRideRequestIdParam(rideRequestId);
        if (!rideId) {
            return res.status(400).json({
                success: false,
                message: "Invalid rideRequestId",
            });
        }

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        const uid = req.user.id;
        const isRiderOrDriver =
            uid === rideRequest.riderId || (rideRequest.driverId != null && uid === rideRequest.driverId);
        const isStaffFinance = await userHasAnyPermission(uid, req.user.userType, [
            "rides.manage",
            "rides.view",
            "wallets.manage",
            "wallets.view",
        ]);

        if (req.user.userType !== "admin" && !isRiderOrDriver && !isStaffFinance) {
            return res.status(403).json({
                success: false,
                message: "Access denied. You cannot record payment for this ride.",
            });
        }

        if (paymentType !== "cash" && paymentType !== "wallet" && !String(transactionId || "").trim()) {
            return res.status(400).json({
                success: false,
                message: "A real gateway transactionId is required for non-cash payments",
            });
        }

        const effectiveAmount = getEffectiveRidePaymentTotal(rideRequest);

        // If wallet payment, deduct from rider wallet before marking paid
        if (paymentType === "wallet") {
            const { debited } = await debitWalletForRideIfSufficient(prisma, {
                userId: rideRequest.riderId,
                amount: effectiveAmount,
                rideRequestId: rideRequest.id,
                description: "Ride payment",
                transactionType: "ride_payment",
            });

            if (!debited) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient wallet balance",
                });
            }
        }

        const payment = await completePaidGatewayPayment(prisma, rideRequest, {
            paymentType,
            transactionId,
            paymentGateway: null,
            amount: effectiveAmount,
        });

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
