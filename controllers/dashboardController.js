import prisma from "../utils/prisma.js";

// Helper function to get start and end of period
const getPeriodDates = (period = "month") => {
    const now = new Date();
    let start, end;

    switch (period) {
        case "today":
            start = new Date(now.setHours(0, 0, 0, 0));
            end = new Date(now.setHours(23, 59, 59, 999));
            break;
        case "week":
            start = new Date(now);
            start.setDate(start.getDate() - 7);
            start.setHours(0, 0, 0, 0);
            end = new Date(now);
            end.setHours(23, 59, 59, 999);
            break;
        case "month":
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case "year":
            start = new Date(now.getFullYear(), 0, 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), 11, 31);
            end.setHours(23, 59, 59, 999);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            start.setHours(0, 0, 0, 0);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
    }

    return { start, end };
};

// @desc    Get admin dashboard with advanced analytics
// @route   GET /api/dashboard/admin-dashboard
// @access  Public
export const adminDashboard = async (req, res) => {
    try {
        const { period = "month" } = req.query;
        const { start, end } = getPeriodDates(period);

        // Basic counts
        const [
            totalRiders,
            totalDrivers,
            totalFleets,
            totalRides,
            completedRides,
            pendingRides,
            cancelledRides,
            activeDrivers,
            activeRiders,
            pendingDrivers,
            scheduledRides,
        ] = await Promise.all([
            prisma.user.count({ where: { userType: "rider" } }),
            prisma.user.count({ where: { userType: "driver" } }),
            prisma.user.count({ where: { userType: "fleet" } }),
            prisma.rideRequest.count(),
            prisma.rideRequest.count({ where: { status: "completed" } }),
            prisma.rideRequest.count({ where: { status: { in: ["pending", "accepted", "in_progress"] } } }),
            prisma.rideRequest.count({ where: { status: "canceled" } }),
            prisma.user.count({ where: { userType: "driver", isOnline: true, status: "active" } }),
            prisma.user.count({ where: { userType: "rider", status: "active" } }),
            prisma.user.count({ where: { userType: "driver", isVerifiedDriver: false } }),
            prisma.rideRequest.count({ where: { isSchedule: true, isPrepaid: true, status: { in: ["scheduled", "pending"] } } }),
        ]);

        // Revenue calculations
        const allPayments = await prisma.payment.findMany({
            where: { paymentStatus: "paid" },
            select: { amount: true, paymentType: true, paymentDate: true },
        });

        const totalRevenue = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const todayPayments = allPayments.filter(
            (p) => new Date(p.paymentDate) >= new Date(new Date().setHours(0, 0, 0, 0))
        );
        const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const periodPayments = allPayments.filter(
            (p) => new Date(p.paymentDate) >= start && new Date(p.paymentDate) <= end
        );
        const monthlyRevenue = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Payment method breakdown
        const paymentMethodBreakdown = {
            cash: allPayments.filter((p) => p.paymentType === "cash").reduce((sum, p) => sum + (p.amount || 0), 0),
            wallet: allPayments.filter((p) => p.paymentType === "wallet").reduce((sum, p) => sum + (p.amount || 0), 0),
            card: allPayments.filter((p) => p.paymentType === "card").reduce((sum, p) => sum + (p.amount || 0), 0),
        };

        // Complaints
        const pendingComplaints = await prisma.complaint.count({
            where: { status: "pending" },
        });

        // Recent rides
        const recentRides = await prisma.rideRequest.findMany({
            take: 10,
            orderBy: { createdAt: "desc" },
            include: {
                rider: { select: { id: true, firstName: true, lastName: true } },
                driver: { select: { id: true, firstName: true, lastName: true } },
                service: { select: { id: true, name: true } },
            },
        });

        res.json({
            success: true,
            data: {
                totalRiders,
                totalDrivers,
                totalFleets,
                totalRides,
                completedRides,
                pendingRides,
                cancelledRides,
                totalRevenue,
                todayRevenue,
                monthlyRevenue,
                activeDrivers,
                activeRiders,
                pendingDrivers,
                pendingComplaints,
                scheduledRides,
                paymentMethodBreakdown,
                recentRides,
            },
        });
    } catch (error) {
        console.error("Admin dashboard error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get dashboard chart data
// @route   GET /api/dashboard/chart-data
// @access  Public
export const getChartData = async (req, res) => {
    try {
        const { type = "monthly", period = "year" } = req.query;
        const { start, end } = getPeriodDates(period);

        let chartData = [];

        if (type === "revenue") {
            // Revenue by month
            const payments = await prisma.payment.findMany({
                where: {
                    paymentStatus: "paid",
                    datetime: { gte: start, lte: end },
                },
                select: { amount: true, datetime: true, paymentType: true },
            });

            // Group by month
            const monthlyData = {};
            payments.forEach((payment) => {
                const month = new Date(payment.datetime).toLocaleString("default", { month: "short" });
                if (!monthlyData[month]) {
                    monthlyData[month] = { cash: 0, wallet: 0, card: 0, total: 0 };
                }
                monthlyData[month][payment.paymentType] = (monthlyData[month][payment.paymentType] || 0) + (payment.amount || 0);
                monthlyData[month].total += payment.amount || 0;
            });

            chartData = Object.keys(monthlyData).map((month) => ({
                name: month,
                cash: monthlyData[month].cash,
                wallet: monthlyData[month].wallet,
                card: monthlyData[month].card,
                total: monthlyData[month].total,
            }));
        } else if (type === "rides") {
            // Rides by month
            const rides = await prisma.rideRequest.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                },
                select: { status: true, createdAt: true },
            });

            const monthlyData = {};
            rides.forEach((ride) => {
                const month = new Date(ride.createdAt).toLocaleString("default", { month: "short" });
                if (!monthlyData[month]) {
                    monthlyData[month] = { completed: 0, cancelled: 0, total: 0 };
                }
                if (ride.status === "completed") monthlyData[month].completed++;
                if (ride.status === "canceled") monthlyData[month].cancelled++;
                monthlyData[month].total++;
            });

            chartData = Object.keys(monthlyData).map((month) => ({
                name: month,
                completed: monthlyData[month].completed,
                cancelled: monthlyData[month].cancelled,
                total: monthlyData[month].total,
            }));
        } else if (type === "users") {
            // Users by month
            const users = await prisma.user.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                },
                select: { userType: true, createdAt: true },
            });

            const monthlyData = {};
            users.forEach((user) => {
                const month = new Date(user.createdAt).toLocaleString("default", { month: "short" });
                if (!monthlyData[month]) {
                    monthlyData[month] = { riders: 0, drivers: 0, total: 0 };
                }
                if (user.userType === "rider") monthlyData[month].riders++;
                if (user.userType === "driver") monthlyData[month].drivers++;
                monthlyData[month].total++;
            });

            chartData = Object.keys(monthlyData).map((month) => ({
                name: month,
                riders: monthlyData[month].riders,
                drivers: monthlyData[month].drivers,
                total: monthlyData[month].total,
            }));
        }

        res.json({
            success: true,
            data: chartData,
        });
    } catch (error) {
        console.error("Get chart data error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get rider dashboard
// @route   GET /api/dashboard/rider-dashboard
// @access  Private
export const riderDashboard = async (req, res) => {
    try {
        const totalRides = await prisma.rideRequest.count({
            where: { riderId: req.user.id },
        });

        const completedRides = await prisma.rideRequest.count({
            where: {
                riderId: req.user.id,
                status: "completed",
            },
        });

        res.json({
            success: true,
            data: {
                totalRides,
                completedRides,
            },
        });
    } catch (error) {
        console.error("Rider dashboard error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get current ride request
// @route   GET /api/dashboard/current-riderequest
// @access  Private
export const currentRideRequest = async (req, res) => {
    try {
        const rideRequest = await prisma.rideRequest.findFirst({
            where: {
                OR: [
                    { riderId: req.user.id },
                    { driverId: req.user.id },
                ],
                status: {
                    in: ["pending", "accepted", "in_progress"],
                },
            },
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        contactNumber: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        contactNumber: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                service: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: rideRequest,
        });
    } catch (error) {
        console.error("Current ride request error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get app settings
// @route   GET /api/dashboard/appsetting
// @access  Public
export const appsetting = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                appName: "Tovo",
                version: "1.0.0",
                currency: "USD",
                currencySymbol: "$",
                distanceUnit: "km",
            },
        });
    } catch (error) {
        console.error("App setting error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
