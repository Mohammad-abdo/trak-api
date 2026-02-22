import prisma from '../../utils/prisma.js';

// @desc    Get all user bookings with status
// @route   GET /apimobile/user/my-bookings
// @access  Private
export const getMyBookings = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { status, page = 1, limit = 20 } = req.query;

        const where = { riderId };
        if (status) where.status = status;

        const bookings = await prisma.rideRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            select: {
                id: true,
                status: true,
                totalAmount: true,
                paymentType: true,
                startAddress: true,
                endAddress: true,
                startLatitude: true,
                startLongitude: true,
                endLatitude: true,
                endLongitude: true,
                otp: true,
                isDriverRated: true,
                createdAt: true,
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        userDetail: { select: { carModel: true, carColor: true, carPlateNumber: true } },
                    },
                },
                service: { select: { id: true, name: true } },
                ratings: {
                    select: { rating: true, comment: true, ratingBy: true },
                    where: { ratingBy: 'rider' },
                },
            },
        });

        const total = await prisma.rideRequest.count({ where });

        return res.json({
            success: true,
            message: 'Bookings retrieved',
            data: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                bookings: bookings.map(b => ({
                    book_id: b.id,
                    status: b.status,
                    totalAmount: b.totalAmount,
                    paymentType: b.paymentType,
                    tripOtp: b.otp,
                    isDriverRated: b.isDriverRated,
                    from: { lat: b.startLatitude, lng: b.startLongitude, address: b.startAddress },
                    to: { lat: b.endLatitude, lng: b.endLongitude, address: b.endAddress },
                    createdAt: b.createdAt,
                    driver: b.driver ? {
                        id: b.driver.id,
                        name: `${b.driver.firstName} ${b.driver.lastName}`.trim(),
                        avatar: b.driver.avatar,
                        vehicleType: b.driver.userDetail?.carModel,
                        vehicleColor: b.driver.userDetail?.carColor,
                        vehiclePlate: b.driver.userDetail?.carPlateNumber,
                    } : null,
                    service: b.service,
                    myRating: b.ratings[0] ?? null,
                })),
            },
        });
    } catch (error) {
        console.error('Get my bookings error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get bookings' });
    }
};

// @desc    Filter bookings by status
// @route   GET /apimobile/user/my-bookings/filter
// @access  Private
export const filterBookings = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { status } = req.query;

        const validStatuses = ['pending', 'accepted', 'started', 'arrived', 'completed', 'cancelled'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`,
            });
        }

        const bookings = await prisma.rideRequest.findMany({
            where: { riderId, status },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                status: true,
                totalAmount: true,
                startAddress: true,
                endAddress: true,
                createdAt: true,
                driver: {
                    select: { id: true, firstName: true, lastName: true, avatar: true },
                },
            },
        });

        return res.json({
            success: true,
            message: `Filtered bookings with status: ${status}`,
            data: bookings.map(b => ({
                book_id: b.id,
                status: b.status,
                totalAmount: b.totalAmount,
                from: b.startAddress,
                to: b.endAddress,
                createdAt: b.createdAt,
                driver: b.driver ? {
                    id: b.driver.id,
                    name: `${b.driver.firstName} ${b.driver.lastName}`.trim(),
                    avatar: b.driver.avatar,
                } : null,
            })),
        });
    } catch (error) {
        console.error('Filter bookings error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to filter bookings' });
    }
};

// @desc    Add a review for a completed booking
// @route   POST /apimobile/user/my-bookings/review
// @access  Private
export const addReview = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { book_id, text, trip_code } = req.body;

        if (!book_id || !text) {
            return res.status(400).json({ success: false, message: 'book_id and text are required' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(book_id), riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (trip_code && booking.otp !== trip_code) {
            return res.status(400).json({ success: false, message: 'Invalid trip code' });
        }

        if (!booking.driverId) {
            return res.status(400).json({ success: false, message: 'No driver assigned to this booking' });
        }

        // Upsert review
        const existing = await prisma.rideRequestRating.findFirst({
            where: { rideRequestId: parseInt(book_id), riderId, ratingBy: 'rider' },
        });

        if (existing) {
            await prisma.rideRequestRating.update({
                where: { id: existing.id },
                data: { comment: text },
            });
        } else {
            await prisma.rideRequestRating.create({
                data: {
                    rideRequestId: parseInt(book_id),
                    riderId,
                    driverId: booking.driverId,
                    rating: 5,
                    comment: text,
                    ratingBy: 'rider',
                },
            });
        }

        return res.json({ success: true, message: 'Review added successfully' });
    } catch (error) {
        console.error('Add review error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to add review' });
    }
};
