import prisma from '../../utils/prisma.js';
import { parseRideRequestIdParam } from '../../utils/rideRequestId.js';
import { fullImageUrl } from '../../utils/imageUrl.js';

const parseServiceData = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (_) {
            return null;
        }
    }
    return null;
};

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
                baseFare: true,
                minimumFare: true,
                perDistance: true,
                perMinuteDrive: true,
                vehicleCategoryId: true,
                paymentType: true,
                startAddress: true,
                endAddress: true,
                startLatitude: true,
                startLongitude: true,
                endLatitude: true,
                endLongitude: true,
                otp: true,
                isDriverRated: true,
                serviceData: true,
                createdAt: true,
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        contactNumber: true,
                        latitude: true,
                        longitude: true,
                        userDetail: { select: { carModel: true, carColor: true, carPlateNumber: true, carImage: true } },
                    },
                },
                service: { select: { id: true, name: true, nameAr: true } },
                ratings: {
                    select: { rating: true, comment: true, ratingBy: true },
                    where: { ratingBy: 'rider' },
                    take: 1,
                },
            },
        });

        const total = await prisma.rideRequest.count({ where });

        const driverIds = [...new Set(bookings.map(b => b.driver?.id).filter(Boolean))];
        const driverAvgRatings = driverIds.length > 0
            ? await prisma.rideRequestRating.groupBy({
                by: ['driverId'],
                where: { driverId: { in: driverIds }, ratingBy: 'rider' },
                _avg: { rating: true },
                _count: { rating: true },
            })
            : [];
        const ratingMap = Object.fromEntries(
            driverAvgRatings.map(r => [r.driverId, { avg: r._avg.rating, count: r._count.rating }])
        );

        return res.json({
            success: true,
            message: 'Bookings retrieved',
            data: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                total_pages: Math.ceil(total / parseInt(limit)),
                bookings: bookings.map(b => ({
                    book_id: b.id,
                    status: b.status,
                    totalAmount: b.totalAmount,
                    baseFare: b.baseFare,
                    minimumFare: b.minimumFare,
                    paymentType: b.paymentType,
                    tripOtp: b.otp,
                    isDriverRated: b.isDriverRated,
                    from: { lat: b.startLatitude, lng: b.startLongitude, address: b.startAddress },
                    to: { lat: b.endLatitude, lng: b.endLongitude, address: b.endAddress },
                    createdAt: b.createdAt,
                    driver: b.driver ? {
                        id: b.driver.id,
                        name: `${b.driver.firstName} ${b.driver.lastName}`.trim(),
                        avatar: fullImageUrl(req, b.driver.avatar),
                        phone: b.driver.contactNumber,
                        currentLocation: { lat: b.driver.latitude, lng: b.driver.longitude },
                        rate: ratingMap[b.driver.id]?.avg ?? null,
                        ratingCount: ratingMap[b.driver.id]?.count ?? 0,
                        vehicleType: b.driver.userDetail?.carModel,
                        vehicleColor: b.driver.userDetail?.carColor,
                        vehiclePlate: b.driver.userDetail?.carPlateNumber,
                        vehicleImage: fullImageUrl(req, b.driver.userDetail?.carImage),
                    } : null,
                    service: b.service,
                    vehicleCategory: (() => {
                        const serviceData = parseServiceData(b.serviceData);
                        if (!serviceData) return null;
                        return {
                            id: serviceData.vehicleCategoryId ?? b.vehicleCategoryId ?? null,
                            name: serviceData.vehicleCategoryName ?? null,
                        };
                    })(),
                    pricing: {
                        totalAmount: b.totalAmount,
                        baseFare: b.baseFare,
                        minimumFare: b.minimumFare,
                        perDistance: b.perDistance,
                        perMinuteDrive: b.perMinuteDrive,
                    },
                    review: b.ratings[0]?.comment ?? null,
                    reviewRating: b.ratings[0]?.rating ?? null,
                })),
            },
        });
    } catch (error) {
        console.error('Get my bookings error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get bookings' });
    }
};

// @desc    Filter bookings by status (same rich response as getMyBookings)
// @route   GET /apimobile/user/my-bookings/filter
// @access  Private
export const filterBookings = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { status, page = 1, limit = 20 } = req.query;

        const validStatuses = ['pending', 'accepted', 'started', 'arrived', 'completed', 'cancelled'];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(', ')}`,
            });
        }

        const where = { riderId, status };

        const bookings = await prisma.rideRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            select: {
                id: true,
                status: true,
                totalAmount: true,
                baseFare: true,
                minimumFare: true,
                perDistance: true,
                perMinuteDrive: true,
                vehicleCategoryId: true,
                paymentType: true,
                startAddress: true,
                endAddress: true,
                startLatitude: true,
                startLongitude: true,
                endLatitude: true,
                endLongitude: true,
                otp: true,
                isDriverRated: true,
                serviceData: true,
                createdAt: true,
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        contactNumber: true,
                        latitude: true,
                        longitude: true,
                        userDetail: { select: { carModel: true, carColor: true, carPlateNumber: true, carImage: true } },
                    },
                },
                service: { select: { id: true, name: true, nameAr: true } },
                ratings: {
                    select: { rating: true, comment: true, ratingBy: true },
                    where: { ratingBy: 'rider' },
                    take: 1,
                },
            },
        });

        const total = await prisma.rideRequest.count({ where });

        const driverIds = [...new Set(bookings.map(b => b.driver?.id).filter(Boolean))];
        const driverAvgRatings = driverIds.length > 0
            ? await prisma.rideRequestRating.groupBy({
                by: ['driverId'],
                where: { driverId: { in: driverIds }, ratingBy: 'rider' },
                _avg: { rating: true },
                _count: { rating: true },
            })
            : [];
        const ratingMap = Object.fromEntries(
            driverAvgRatings.map(r => [r.driverId, { avg: r._avg.rating, count: r._count.rating }])
        );

        return res.json({
            success: true,
            message: `Filtered bookings with status: ${status}`,
            data: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                bookings: bookings.map(b => ({
                    book_id: b.id,
                    status: b.status,
                    totalAmount: b.totalAmount,
                    baseFare: b.baseFare,
                    minimumFare: b.minimumFare,
                    paymentType: b.paymentType,
                    tripOtp: b.otp,
                    isDriverRated: b.isDriverRated,
                    from: { lat: b.startLatitude, lng: b.startLongitude, address: b.startAddress },
                    to: { lat: b.endLatitude, lng: b.endLongitude, address: b.endAddress },
                    createdAt: b.createdAt,
                    driver: b.driver ? {
                        id: b.driver.id,
                        name: `${b.driver.firstName} ${b.driver.lastName}`.trim(),
                        avatar: fullImageUrl(req, b.driver.avatar),
                        phone: b.driver.contactNumber,
                        currentLocation: { lat: b.driver.latitude, lng: b.driver.longitude },
                        rate: ratingMap[b.driver.id]?.avg ?? null,
                        ratingCount: ratingMap[b.driver.id]?.count ?? 0,
                        vehicleType: b.driver.userDetail?.carModel,
                        vehicleColor: b.driver.userDetail?.carColor,
                        vehiclePlate: b.driver.userDetail?.carPlateNumber,
                        vehicleImage: fullImageUrl(req, b.driver.userDetail?.carImage),
                    } : null,
                    service: b.service,
                    vehicleCategory: (() => {
                        const serviceData = parseServiceData(b.serviceData);
                        if (!serviceData) return null;
                        return {
                            id: serviceData.vehicleCategoryId ?? b.vehicleCategoryId ?? null,
                            name: serviceData.vehicleCategoryName ?? null,
                        };
                    })(),
                    pricing: {
                        totalAmount: b.totalAmount,
                        baseFare: b.baseFare,
                        minimumFare: b.minimumFare,
                        perDistance: b.perDistance,
                        perMinuteDrive: b.perMinuteDrive,
                    },
                    review: b.ratings[0]?.comment ?? null,
                    reviewRating: b.ratings[0]?.rating ?? null,
                })),
            },
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
        const rideId = parseRideRequestIdParam(book_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid book_id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
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
            where: { rideRequestId: rideId, riderId, ratingBy: 'rider' },
        });

        if (existing) {
            await prisma.rideRequestRating.update({
                where: { id: existing.id },
                data: { comment: text },
            });
        } else {
            await prisma.rideRequestRating.create({
                data: {
                    rideRequestId: rideId,
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
