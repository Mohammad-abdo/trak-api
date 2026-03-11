import prisma from '../../utils/prisma.js';
import { fullImageUrl } from '../../utils/imageUrl.js';

// @desc    Get slider offers (coupons) – data from database only (same as admin dashboard)
// @route   GET /apimobile/user/home/slider-offers
// @access  Private
export const sliderOffers = async (req, res) => {
    try {
        const coupons = await prisma.coupon.findMany({
            where: { status: 1 },
            select: {
                id: true,
                title: true,
                titleAr: true,
                imageUrl: true,
                discountType: true,
                discount: true,
                description: true,
                descriptionAr: true,
                startDate: true,
                endDate: true,
                code: true,
                minimumAmount: true,
                maximumDiscount: true,
                serviceIds: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });

        return res.json({
            success: true,
            message: 'Slider offers retrieved',
            data: coupons.map(c => ({
                id: c.id,
                title: c.title,
                titleAr: c.titleAr,
                image: fullImageUrl(req, c.imageUrl),
                discountType: c.discountType,
                discountValue: c.discount,
                description: c.description,
                startDate: c.startDate,
                endDate: c.endDate,
                code: c.code,
                minimumAmount: c.minimumAmount,
                maximumDiscount: c.maximumDiscount,
                vehicleCategories: c.serviceIds,
            })),
        });
    } catch (error) {
        console.error('Slider offers error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get offers' });
    }
};

// Main service category image URLs (used when imageUrl is null or column missing)
const SERVICE_CATEGORY_IMAGES = {
    'passenger-transport': 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
    'cargo-transport': 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800',
    'additional-services': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
};

// @desc    Get all services
// @route   GET /apimobile/user/home/services
// @access  Private
export const getAllServices = async (req, res) => {
    try {
        const categories = await prisma.serviceCategory.findMany({
            where: { status: 1 },
            select: {
                id: true,
                name: true,
                nameAr: true,
                icon: true,
                slug: true,
                description: true,
                imageUrl: true,
                vehicleCategories: {
                    where: { status: 1 },
                    select: { id: true, name: true, nameAr: true, image: true, icon: true },
                },
            },
        });

        const data = categories.map(cat => ({
            ...cat,
            image: fullImageUrl(req, cat.imageUrl) || SERVICE_CATEGORY_IMAGES[cat.slug] || null,
            imageUrl: undefined,
            vehicleCategories: cat.vehicleCategories.map(vc => ({
                ...vc,
                image: fullImageUrl(req, vc.image),
            })),
        }));

        return res.json({
            success: true,
            message: 'Services retrieved',
            data,
        });
    } catch (error) {
        console.error('Get services error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get services' });
    }
};

// @desc    Get user bookings (paginated, newest first, any status).
// @route   GET /apimobile/user/home/last-booking
// @access  Private
export const getLastCurrentUserBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
        const skip = (page - 1) * limit;

        const where = { riderId: userId };

        const [bookings, total] = await Promise.all([
            prisma.rideRequest.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    status: true,
                    startLatitude: true,
                    startLongitude: true,
                    startAddress: true,
                    endLatitude: true,
                    endLongitude: true,
                    endAddress: true,
                    totalAmount: true,
                    paymentType: true,
                    otp: true,
                    isDriverRated: true,
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
                            userDetail: {
                                select: { carModel: true, carColor: true, carPlateNumber: true, carImage: true },
                            },
                        },
                    },
                    ratings: {
                        where: { ratingBy: 'rider' },
                        select: { rating: true, comment: true },
                        take: 1,
                    },
                    service: { select: { id: true, name: true, nameAr: true } },
                },
            }),
            prisma.rideRequest.count({ where }),
        ]);

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

        const data = bookings.map(booking => ({
            book_id: booking.id,
            status: booking.status,
            from: { lat: booking.startLatitude, lng: booking.startLongitude, address: booking.startAddress },
            to: { lat: booking.endLatitude, lng: booking.endLongitude, address: booking.endAddress },
            totalAmount: booking.totalAmount,
            paymentType: booking.paymentType,
            tripOtp: booking.otp,
            isDriverRated: booking.isDriverRated,
            createdAt: booking.createdAt,
            driver: booking.driver ? {
                id: booking.driver.id,
                name: `${booking.driver.firstName || ''} ${booking.driver.lastName || ''}`.trim(),
                avatar: fullImageUrl(req, booking.driver.avatar),
                phone: booking.driver.contactNumber,
                currentLocation: { lat: booking.driver.latitude, lng: booking.driver.longitude },
                rate: ratingMap[booking.driver.id]?.avg ?? null,
                ratingCount: ratingMap[booking.driver.id]?.count ?? 0,
                vehicleType: booking.driver.userDetail?.carModel,
                vehicleColor: booking.driver.userDetail?.carColor,
                vehiclePlate: booking.driver.userDetail?.carPlateNumber,
                vehicleImage: fullImageUrl(req, booking.driver.userDetail?.carImage),
            } : null,
            review: booking.ratings[0]?.comment ?? null,
            reviewRating: booking.ratings[0]?.rating ?? null,
            service: booking.service,
        }));

        return res.json({
            success: true,
            message: 'Last bookings retrieved',
            data: {
                total,
                page,
                limit,
                total_pages: Math.ceil(total / limit),
                bookings: data,
            },
        });
    } catch (error) {
        console.error('Last booking error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get last booking' });
    }
};
