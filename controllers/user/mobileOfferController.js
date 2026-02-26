import prisma from '../../utils/prisma.js';

// Helper: Calculate distance between two coordinates (Haversine formula)
const haversineKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// @desc    Get near drivers for a booking
// @route   POST /apimobile/user/offers/near-drivers
// @access  Private
export const getNearDrivers = async (req, res) => {
    try {
        const { booking_location, booking_id } = req.body;

        if (!booking_location || !booking_location.lat || !booking_location.lng || !booking_id) {
            return res.status(400).json({ success: false, message: 'booking_location (lat/lng) and booking_id are required' });
        }

        const booking = await prisma.rideRequest.findUnique({
            where: { id: parseInt(booking_id) },
            select: { id: true, vehicleCategoryId: true, totalAmount: true },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Get all online, available drivers (riders with userType=rider are excluded)
        const drivers = await prisma.user.findMany({
            where: {
                userType: 'driver',
                isOnline: true,
                isAvailable: true,
                status: 'active',
                latitude: { not: null },
                longitude: { not: null },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                latitude: true,
                longitude: true,
                userDetail: {
                    select: { carModel: true, carColor: true, carPlateNumber: true },
                },
            },
        });

        const bLat = parseFloat(booking_location.lat);
        const bLng = parseFloat(booking_location.lng);

        // Progressive search: 1km, 2km, 3km, 4km, 5km
        const radii = [1, 2, 3, 4, 5];
        let nearDrivers = [];

        for (const radius of radii) {
            nearDrivers = drivers.filter(d => {
                const dLat = parseFloat(d.latitude);
                const dLng = parseFloat(d.longitude);
                return haversineKm(bLat, bLng, dLat, dLng) <= radius;
            });

            if (nearDrivers.length > 0) break;
        }

        if (nearDrivers.length === 0) {
            return res.json({
                success: false,
                message: 'No drivers found within 5km. Please try again.',
                data: [],
            });
        }

        const data = nearDrivers.map(d => ({
            id: d.id,
            name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
            avatar: d.avatar,
            rate: 4.5, // TODO: calculate from RideRequestRating
            price: booking.totalAmount,
            vehicleType: d.userDetail?.carModel ?? 'Vehicle',
            vehicleImage: null,
            currentLocation: { lat: d.latitude, lng: d.longitude },
        }));

        return res.json({ success: true, message: 'Nearby drivers found', data });
    } catch (error) {
        console.error('Get near drivers error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get nearby drivers' });
    }
};

// @desc    Accept a driver for a booking
// @route   POST /apimobile/user/offers/accept-driver
// @access  Private
export const acceptDriver = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { driver_id, booking_id } = req.body;

        if (!driver_id || !booking_id) {
            return res.status(400).json({ success: false, message: 'driver_id and booking_id are required' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(booking_id), riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const tripCode = `TRP${Date.now()}`;

        const updated = await prisma.rideRequest.update({
            where: { id: parseInt(booking_id) },
            data: {
                driverId: parseInt(driver_id),
                status: 'accepted',
                otp: tripCode.slice(-6),
            },
            select: {
                id: true,
                status: true,
                totalAmount: true,
                otp: true,
                startLatitude: true,
                startLongitude: true,
                startAddress: true,
                endLatitude: true,
                endLongitude: true,
                endAddress: true,
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
            },
        });

        // Notify driver via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(`driver-${driver_id}`).emit('ride-request-accepted', {
                booking_id: parseInt(booking_id),
                rider_id: riderId,
            });
        }

        return res.json({
            success: true,
            message: 'Driver accepted successfully',
            data: {
                booking_id: updated.id,
                trip_code: updated.otp,
                price: updated.totalAmount,
                tripStatus: { status: 'pending' },
                from: { lat: updated.startLatitude, lng: updated.startLongitude, address: updated.startAddress },
                to: { lat: updated.endLatitude, lng: updated.endLongitude, address: updated.endAddress },
                driverInfo: updated.driver ? {
                    id: updated.driver.id,
                    name: `${updated.driver.firstName} ${updated.driver.lastName}`.trim(),
                    avatar: updated.driver.avatar,
                    phone: updated.driver.contactNumber,
                    currentLocation: { lat: updated.driver.latitude, lng: updated.driver.longitude },
                    vehicle: updated.driver.userDetail,
                } : null,
            },
        });
    } catch (error) {
        console.error('Accept driver error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to accept driver' });
    }
};

// @desc    Cancel driver offer – remove assigned driver from booking so rider can choose another
// @route   POST /apimobile/user/offers/cancel-driver-offer
// @access  Private
export const cancelDriverOffer = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { driver_id, booking_id } = req.body;

        if (!driver_id || !booking_id) {
            return res.status(400).json({ success: false, message: 'driver_id and booking_id are required' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(booking_id), riderId },
            select: { id: true, status: true, driverId: true },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.status !== 'accepted' || !booking.driverId) {
            return res.status(400).json({
                success: false,
                message: 'No driver is assigned to this booking, or booking is not in accepted state',
            });
        }

        if (booking.driverId !== parseInt(driver_id)) {
            return res.status(400).json({ success: false, message: 'Driver does not match this booking' });
        }

        await prisma.rideRequest.update({
            where: { id: parseInt(booking_id) },
            data: {
                driverId: null,
                riderequestInDriverId: null,
                status: 'pending',
                otp: null,
            },
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`driver-${driver_id}`).emit('driver-offer-cancelled', {
                booking_id: parseInt(booking_id),
                rider_id: riderId,
            });
        }

        return res.json({
            success: true,
            message: 'Driver offer cancelled. You can select another driver.',
            data: { booking_id: parseInt(booking_id), status: 'pending' },
        });
    } catch (error) {
        console.error('Cancel driver offer error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to cancel driver offer' });
    }
};

// @desc    Track driver (returns latest driver location, opens WebSocket for live tracking)
// @route   POST /apimobile/user/offers/track-driver
// @access  Private
export const trackDriver = async (req, res) => {
    try {
        const { driver_id, booking_id } = req.body;

        if (!driver_id || !booking_id) {
            return res.status(400).json({ success: false, message: 'driver_id and booking_id are required' });
        }

        const driver = await prisma.user.findUnique({
            where: { id: parseInt(driver_id) },
            select: { id: true, latitude: true, longitude: true, lastLocationUpdateAt: true },
        });

        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        // Notify via Socket.IO to start tracking
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${req.user.id}`).emit('trip-tracking-started', {
                booking_id: parseInt(booking_id),
                driver_id: parseInt(driver_id),
            });
        }

        return res.json({
            success: true,
            message: 'Tracking started. Connect to WebSocket room: ride-' + booking_id,
            data: {
                booking_id: parseInt(booking_id),
                driver_id: parseInt(driver_id),
                driverCurrentLocation: { lat: driver.latitude, lng: driver.longitude },
                lastUpdated: driver.lastLocationUpdateAt,
                webSocket: { event: 'subscribe-ride', room: `ride-${booking_id}` },
            },
        });
    } catch (error) {
        console.error('Track driver error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to start tracking' });
    }
};

// @desc    Get trip status
// @route   GET /apimobile/user/offers/trip-status/:bookingId
// @access  Private
export const getTripStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const riderId = req.user.id;

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(bookingId), riderId },
            select: {
                id: true,
                status: true,
                otp: true,
                totalAmount: true,
                startLatitude: true,
                startLongitude: true,
                startAddress: true,
                endLatitude: true,
                endLongitude: true,
                endAddress: true,
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        latitude: true,
                        longitude: true,
                    },
                },
            },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        return res.json({
            success: true,
            message: `Trip status: ${booking.status}`,
            data: {
                booking_id: booking.id,
                status: booking.status,
                tripStarted: ['started', 'arrived', 'completed'].includes(booking.status),
                trip_code: booking.otp,
                price: booking.totalAmount,
                from: { lat: booking.startLatitude, lng: booking.startLongitude, address: booking.startAddress },
                to: { lat: booking.endLatitude, lng: booking.endLongitude, address: booking.endAddress },
                driverLocation: booking.driver ? { lat: booking.driver.latitude, lng: booking.driver.longitude } : null,
            },
        });
    } catch (error) {
        console.error('Trip status error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get trip status' });
    }
};

// @desc    Cancel trip from user
// @route   POST /apimobile/user/offers/cancel-trip
// @access  Private
export const cancelTrip = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { driver_id, booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({ success: false, message: 'booking_id is required' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(booking_id), riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (['completed', 'cancelled'].includes(booking.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} trip` });
        }

        await prisma.rideRequest.update({
            where: { id: parseInt(booking_id) },
            data: { status: 'cancelled', cancelBy: 'rider' },
        });

        // Notify driver
        const io = req.app.get('io');
        if (io && driver_id) {
            io.to(`driver-${driver_id}`).emit('trip-cancelled', { booking_id: parseInt(booking_id), cancelled_by: 'rider' });
        }

        return res.json({ success: true, message: 'Trip cancelled successfully' });
    } catch (error) {
        console.error('Cancel trip error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to cancel trip' });
    }
};

// @desc    End trip
// @route   POST /apimobile/user/offers/trip-end
// @access  Private
export const tripEnd = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { driver_id, booking_id } = req.body;

        if (!booking_id) {
            return res.status(400).json({ success: false, message: 'booking_id is required' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(booking_id), riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        await prisma.rideRequest.update({
            where: { id: parseInt(booking_id) },
            data: { status: 'completed' },
        });

        // Notify driver
        const io = req.app.get('io');
        if (io && driver_id) {
            io.to(`driver-${driver_id}`).emit('trip-completed', { booking_id: parseInt(booking_id) });
        }

        return res.json({ success: true, message: 'Trip ended successfully. Please rate your driver.' });
    } catch (error) {
        console.error('Trip end error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to end trip' });
    }
};

// @desc    Rate the driver
// @route   POST /apimobile/user/offers/rate-driver
// @access  Private
export const rateDriver = async (req, res) => {
    try {
        const riderId = req.user.id;
        const { driver_id, booking_id, rate, text } = req.body;

        if (!driver_id || !booking_id || !rate) {
            return res.status(400).json({ success: false, message: 'driver_id, booking_id, and rate are required' });
        }

        if (rate < 1 || rate > 5) {
            return res.status(400).json({ success: false, message: 'Rate must be between 1 and 5' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: parseInt(booking_id), riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.isDriverRated) {
            return res.status(400).json({ success: false, message: 'Driver has already been rated for this trip' });
        }

        await prisma.rideRequestRating.create({
            data: {
                rideRequestId: parseInt(booking_id),
                riderId,
                driverId: parseInt(driver_id),
                rating: parseFloat(rate),
                comment: text || null,
                ratingBy: 'rider',
            },
        });

        await prisma.rideRequest.update({
            where: { id: parseInt(booking_id) },
            data: { isDriverRated: true },
        });

        return res.json({ success: true, message: 'Driver rated successfully' });
    } catch (error) {
        console.error('Rate driver error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to rate driver' });
    }
};
