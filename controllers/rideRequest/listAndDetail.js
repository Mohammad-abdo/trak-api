import prisma from "../../utils/prisma.js";

// @desc    Get ride request list with advanced filtering
// @route   GET /api/ride-requests/riderequest-list
// @access  Private
export const getRideRequestList = async (req, res) => {
    try {
        const {
            status, type, serviceId, isSchedule,
            riderId, driverId, fromDate, toDate,
            paymentStatus, paymentMethod, rideStatus, search,
            per_page = 10, page = 1,
            sortBy = "createdAt", sortOrder = "desc",
        } = req.query;

        const where = {};

        if (req.user.userType === "rider") where.riderId = req.user.id;
        else if (req.user.userType === "driver") where.driverId = req.user.id;

        if (status) {
            if (status === "upcoming") where.datetime = { gte: new Date() };
            else if (status === "canceled") where.status = "canceled";
            else where.status = status;
        }

        if (serviceId) where.serviceId = parseInt(serviceId);
        if (isSchedule !== undefined) where.isSchedule = isSchedule === "true" || isSchedule === true;
        if (riderId) where.riderId = parseInt(riderId);
        if (driverId) where.driverId = parseInt(driverId);
        if (rideStatus) where.status = rideStatus;

        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate);
            if (toDate) {
                const toDateObj = new Date(toDate);
                toDateObj.setHours(23, 59, 59, 999);
                where.createdAt.lte = toDateObj;
            }
        }

        if (search) {
            where.OR = [
                { startAddress: { contains: search, mode: "insensitive" } },
                { endAddress: { contains: search, mode: "insensitive" } },
            ];
        }

        if (paymentStatus || paymentMethod) {
            where.payments = { some: {} };
            if (paymentStatus) where.payments.some.paymentStatus = paymentStatus;
            if (paymentMethod) where.payments.some.paymentType = paymentMethod;
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);
        const orderBy = { [sortBy]: sortOrder === "asc" ? "asc" : "desc" };

        const [rideRequests, total] = await Promise.all([
            prisma.rideRequest.findMany({
                where,
                include: {
                    rider: { select: { id: true, firstName: true, lastName: true, contactNumber: true, email: true } },
                    driver: { select: { id: true, firstName: true, lastName: true, contactNumber: true, email: true } },
                    service: { select: { id: true, name: true } },
                    payments: { select: { id: true, paymentStatus: true, paymentType: true, amount: true }, take: 1, orderBy: { createdAt: "desc" } },
                },
                skip,
                take: parseInt(per_page),
                orderBy,
            }),
            prisma.rideRequest.count({ where }),
        ]);

        res.json({
            success: true,
            data: rideRequests,
            pagination: { total, page: parseInt(page), per_page: parseInt(per_page), total_pages: Math.ceil(total / parseInt(per_page)) },
        });
    } catch (error) {
        console.error("Get ride request list error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get ride request detail
// @route   GET /api/ride-requests/riderequest-detail
// @access  Private
export const getRideRequestDetail = async (req, res) => {
    try {
        const { id } = req.query;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: parseInt(id) },
            include: {
                rider: { select: { id: true, firstName: true, lastName: true, contactNumber: true, email: true } },
                driver: { select: { id: true, firstName: true, lastName: true, contactNumber: true, email: true, latitude: true, longitude: true } },
                service: { select: { id: true, name: true, baseFare: true } },
            },
        });

        if (!rideRequest) {
            return res.status(404).json({ success: false, message: "Ride request not found" });
        }

        res.json({ success: true, data: rideRequest });
    } catch (error) {
        console.error("Get ride request detail error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
