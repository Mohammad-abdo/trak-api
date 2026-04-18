import prisma from '../../utils/prisma.js';
import { fullImageUrl } from '../../utils/imageUrl.js';
import { parseRideRequestIdParam } from '../../utils/rideRequestId.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { successResponse, errorResponse } from '../../utils/serverResponse.js';
import { emitToDriver, emitToRide } from '../../utils/socketService.js';

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

const parseDriverId = (value) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseLatLng = (lat, lng) => {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return null;
    return { lat: latNum, lng: lngNum };
};

// @desc    Get near drivers for a booking
// @route   POST /apimobile/user/offers/near-drivers
// @access  Private
export const getNearDrivers = async (req, res) => {
    try {
        const { booking_location, booking_id } = req.body;

        if (
            !booking_location ||
            booking_location.lat === undefined ||
            booking_location.lng === undefined ||
            !booking_id
        ) {
            return res.status(400).json({ success: false, message: 'booking_location (lat/lng) and booking_id are required' });
        }
        const bookingCoords = parseLatLng(booking_location.lat, booking_location.lng);
        if (!bookingCoords) {
            return res.status(400).json({ success: false, message: 'booking_location (lat/lng) and booking_id are required' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findUnique({
            where: { id: rideId },
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

        const bLat = bookingCoords.lat;
        const bLng = bookingCoords.lng;

        // Progressive search: 1km, 2km, 3km, 4km, 5km
        const radii = [1, 2, 3, 4, 5];
        let nearDrivers = [];

        for (const radius of radii) {
            nearDrivers = drivers.filter(d => {
                const dLat = parseFloat(d.latitude);
                const dLng = parseFloat(d.longitude);
                if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) return false;
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
            avatar: fullImageUrl(req, d.avatar),
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
        const driverId = parseDriverId(driver_id);
        if (!driverId) {
            return res.status(400).json({ success: false, message: 'driver_id and booking_id are required' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        const tripCode = `TRP${Date.now()}`;

        const updated = await prisma.rideRequest.update({
            where: { id: rideId },
            data: {
                driverId,
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
            io.to(`driver-${driverId}`).emit('ride-request-accepted', {
                booking_id: rideId,
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
                    avatar: fullImageUrl(req, updated.driver.avatar),
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
        const driverId = parseDriverId(driver_id);
        if (!driverId) {
            return res.status(400).json({ success: false, message: 'driver_id and booking_id are required' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
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

        if (booking.driverId !== driverId) {
            return res.status(400).json({ success: false, message: 'Driver does not match this booking' });
        }

        await prisma.rideRequest.update({
            where: { id: rideId },
            data: {
                driverId: null,
                riderequestInDriverId: null,
                status: 'pending',
                otp: null,
            },
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`driver-${driverId}`).emit('driver-offer-cancelled', {
                booking_id: rideId,
                rider_id: riderId,
            });
        }

        return res.json({
            success: true,
            message: 'Driver offer cancelled. You can select another driver.',
            data: { booking_id: rideId, status: 'pending' },
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
        const driverId = parseDriverId(driver_id);
        if (!driverId) {
            return res.status(400).json({ success: false, message: 'driver_id and booking_id are required' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const driver = await prisma.user.findUnique({
            where: { id: driverId },
            select: { id: true, latitude: true, longitude: true, lastLocationUpdateAt: true },
        });

        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        // Notify via Socket.IO to start tracking
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${req.user.id}`).emit('trip-tracking-started', {
                booking_id: rideId,
                driver_id: driverId,
            });
        }

        return res.json({
            success: true,
            message: 'Tracking started. Connect to WebSocket room: ride-' + rideId,
            data: {
                booking_id: rideId,
                driver_id: driverId,
                driverCurrentLocation: { lat: driver.latitude, lng: driver.longitude },
                lastUpdated: driver.lastLocationUpdateAt,
                webSocket: { event: 'subscribe-ride', room: `ride-${rideId}` },
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
        const rideId = parseRideRequestIdParam(bookingId);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
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
        const driverId = driver_id ? parseDriverId(driver_id) : null;
        if (driver_id && !driverId) {
            return res.status(400).json({ success: false, message: 'Invalid driver_id' });
        }

        if (!booking_id) {
            return res.status(400).json({ success: false, message: 'booking_id is required' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (['completed', 'cancelled'].includes(booking.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel a ${booking.status} trip` });
        }

        await prisma.rideRequest.update({
            where: { id: rideId },
            data: { status: 'cancelled', cancelBy: 'rider' },
        });

        // Notify driver
        const io = req.app.get('io');
        if (io && driverId) {
            io.to(`driver-${driverId}`).emit('trip-cancelled', { booking_id: rideId, cancelled_by: 'rider' });
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
        const driverId = driver_id ? parseDriverId(driver_id) : null;
        if (driver_id && !driverId) {
            return res.status(400).json({ success: false, message: 'Invalid driver_id' });
        }

        if (!booking_id) {
            return res.status(400).json({ success: false, message: 'booking_id is required' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        await prisma.rideRequest.update({
            where: { id: rideId },
            data: { status: 'completed' },
        });

        // Notify driver
        const io = req.app.get('io');
        if (io && driverId) {
            io.to(`driver-${driverId}`).emit('trip-completed', { booking_id: rideId });
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
        const driverId = parseDriverId(driver_id);
        if (!driverId) {
            return res.status(400).json({ success: false, message: 'driver_id, booking_id, and rate are required' });
        }
        const numericRate = parseFloat(rate);
        if (!Number.isFinite(numericRate)) {
            return res.status(400).json({ success: false, message: 'Rate must be between 1 and 5' });
        }

        if (numericRate < 1 || numericRate > 5) {
            return res.status(400).json({ success: false, message: 'Rate must be between 1 and 5' });
        }
        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findFirst({
            where: { id: rideId, riderId },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.isDriverRated) {
            return res.status(400).json({ success: false, message: 'Driver has already been rated for this trip' });
        }

        await prisma.rideRequestRating.create({
            data: {
                rideRequestId: rideId,
                riderId,
                driverId,
                rating: numericRate,
                comment: text || null,
                ratingBy: 'rider',
            },
        });

        await prisma.rideRequest.update({
            where: { id: rideId },
            data: { isDriverRated: true },
        });

        return res.json({ success: true, message: 'Driver rated successfully' });
    } catch (error) {
        console.error('Rate driver error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to rate driver' });
    }
};

const ACTIVE_RIDE_STATUSES = ['pending', 'accepted', 'arrived', 'arrived_at_pickup', 'in_progress', 'ongoing', 'started'];

// @desc    Get the rider's currently active (ongoing) ride, if any
// @route   GET /apimobile/user/offers/active-ride
// @access  Private
export const getActiveRide = asyncHandler(async (req, res) => {
    const riderId = req.user.id;

    const ride = await prisma.rideRequest.findFirst({
        where: { riderId, status: { in: ACTIVE_RIDE_STATUSES } },
        orderBy: { createdAt: 'desc' },
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
            createdAt: true,
            driver: {
                select: {
                    id: true, firstName: true, lastName: true,
                    avatar: true, contactNumber: true, latitude: true, longitude: true,
                },
            },
        },
    });

    if (!ride) return successResponse(res, null, 'No active ride');

    return successResponse(res, {
        ...ride,
        driver: ride.driver ? { ...ride.driver, avatar: fullImageUrl(req, ride.driver.avatar) } : null,
    }, 'Active ride retrieved');
});

// @desc    Trigger an SOS alert during a ride
// @route   POST /apimobile/user/offers/sos
// @access  Private
export const triggerSosAlert = asyncHandler(async (req, res) => {
    const riderId = req.user.id;
    const { rideRequestId, latitude, longitude, note } = req.body || {};

    if (!rideRequestId) return errorResponse(res, 'rideRequestId is required', 400);

    const rid = parseRideRequestIdParam(rideRequestId);
    if (!rid) return errorResponse(res, 'Invalid rideRequestId', 400);

    const ride = await prisma.rideRequest.findFirst({
        where: { id: rid, riderId },
        select: { id: true, driverId: true, status: true },
    });
    if (!ride) return errorResponse(res, 'Ride not found or not yours', 404);

    const payload = {
        rideRequestId: ride.id,
        riderId,
        driverId: ride.driverId,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        note: note ? String(note).slice(0, 500) : null,
        triggeredAt: new Date(),
    };

    // Log as a notification record for admin/ops.
    await prisma.notification.create({
        data: {
            type: 'sos_alert',
            notifiableType: 'admin',
            notifiableId: 0,
            data: payload,
        },
    });

    // Broadcast to ride participants + driver explicitly
    const io = req.app.get('io');
    if (io) {
        emitToRide(io, ride.id, 'sos:alert', payload);
        if (ride.driverId) emitToDriver(io, ride.driverId, 'sos:alert', payload);
    }

    return successResponse(res, payload, 'SOS alert sent', 201);
});

// @desc    Tip the driver after or during a ride
// @route   POST /apimobile/user/offers/tip
// @access  Private
export const tipDriver = asyncHandler(async (req, res) => {
    const riderId = req.user.id;
    const { rideRequestId, amount } = req.body || {};

    if (!rideRequestId || amount === undefined) {
        return errorResponse(res, 'rideRequestId and amount are required', 400);
    }
    const rid = parseRideRequestIdParam(rideRequestId);
    const numericAmount = parseFloat(amount);
    if (!rid) return errorResponse(res, 'Invalid rideRequestId', 400);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return errorResponse(res, 'amount must be a positive number', 400);
    }

    const ride = await prisma.rideRequest.findFirst({
        where: { id: rid, riderId },
        select: { id: true, driverId: true, tips: true, totalAmount: true, status: true },
    });
    if (!ride) return errorResponse(res, 'Ride not found or not yours', 404);

    const newTip = (ride.tips || 0) + numericAmount;
    const newTotal = (ride.totalAmount || 0) + numericAmount;

    const updated = await prisma.rideRequest.update({
        where: { id: ride.id },
        data: { tips: newTip, totalAmount: newTotal },
        select: { id: true, tips: true, totalAmount: true, status: true },
    });

    const io = req.app.get('io');
    if (io && ride.driverId) {
        emitToDriver(io, ride.driverId, 'ride:tip', {
            rideRequestId: ride.id,
            amount: numericAmount,
            totalTips: newTip,
        });
    }

    return successResponse(res, updated, 'Tip added successfully', 201);
});
