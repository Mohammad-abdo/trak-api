import prisma from '../../utils/prisma.js';

// @desc    Get slider offers (coupons)
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
                image: null, // Coupon model has no image field – set null for now
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
                vehicleCategories: {
                    where: { status: 1 },
                    select: { id: true, name: true, nameAr: true, image: true, icon: true },
                },
            },
        });

        return res.json({
            success: true,
            message: 'Services retrieved',
            data: categories,
        });
    } catch (error) {
        console.error('Get services error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get services' });
    }
};

// @desc    Get last N current user bookings (array, newest first). Default 5, any status.
// @route   GET /apimobile/user/home/last-booking
// @access  Private
export const getLastCurrentUserBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit, 10) || 5, 50);

        const bookings = await prisma.rideRequest.findMany({
            where: { riderId: userId },
            orderBy: { createdAt: 'desc' },
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
                            select: { carModel: true, carColor: true, carPlateNumber: true },
                        },
                    },
                },
                service: { select: { id: true, name: true } },
            },
        });

        const data = bookings.map(booking => ({
            book_id: booking.id,
            status: booking.status,
            from: { lat: booking.startLatitude, lng: booking.startLongitude, address: booking.startAddress },
            to: { lat: booking.endLatitude, lng: booking.endLongitude, address: booking.endAddress },
            totalAmount: booking.totalAmount,
            paymentType: booking.paymentType,
            tripOtp: booking.otp,
            createdAt: booking.createdAt,
            driver: booking.driver ? {
                id: booking.driver.id,
                name: `${booking.driver.firstName || ''} ${booking.driver.lastName || ''}`.trim(),
                avatar: booking.driver.avatar,
                phone: booking.driver.contactNumber,
                currentLocation: { lat: booking.driver.latitude, lng: booking.driver.longitude },
                vehicleType: booking.driver.userDetail?.carModel,
                vehicleColor: booking.driver.userDetail?.carColor,
                vehiclePlate: booking.driver.userDetail?.carPlateNumber,
            } : null,
            service: booking.service,
        }));

        return res.json({
            success: true,
            message: 'Last bookings retrieved',
            data,
        });
    } catch (error) {
        console.error('Last booking error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get last booking' });
    }
};
