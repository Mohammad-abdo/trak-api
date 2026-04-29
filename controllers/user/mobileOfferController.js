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

        if (!booking_id) {
            return res.status(400).json({ success: false, message: 'booking_id is required' });
        }

        const bookingCoords =
            booking_location && booking_location.lat !== undefined && booking_location.lng !== undefined
                ? parseLatLng(booking_location.lat, booking_location.lng)
                : null;

        if (booking_location && !bookingCoords) {
            return res.status(400).json({ success: false, message: 'Invalid booking_location lat/lng' });
        }

        const rideId = parseRideRequestIdParam(booking_id);
        if (!rideId) {
            return res.status(400).json({ success: false, message: 'Invalid booking_id' });
        }

        const booking = await prisma.rideRequest.findUnique({
            where: { id: rideId },
            select: {
                id: true,
                vehicleCategoryId: true,
                totalAmount: true,
                riderId: true,
                driverId: true,
                negotiatedFare: true,
                updatedAt: true,
                isSchedule: true,
                scheduleDatetime: true,
            },
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (booking.riderId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Not authorized for this booking' });
        }

        // Special/scheduled bookings: do not start driver offer search too early.
        if (booking.isSchedule && booking.scheduleDatetime) {
            const now = Date.now();
            const scheduleAt = new Date(booking.scheduleDatetime).getTime();
            const openWindowMs = 30 * 60 * 1000; // 30 minutes before scheduled time
            if (scheduleAt - now > openWindowMs) {
                return res.json({
                    success: true,
                    message: 'Special booking is scheduled for later. Driver offers will open 30 minutes before pickup time.',
                    data: [],
                });
            }
        }

        // Only show drivers that sent a negotiated/bid price for this booking.
        const bids = await prisma.rideRequestBid.findMany({
            where: {
                rideRequestId: rideId,
                bidAmount: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        latitude: true,
                        longitude: true,
                        status: true,
                        isOnline: true,
                        isAvailable: true,
                        userDetail: {
                            select: { carModel: true, carColor: true, carPlateNumber: true },
                        },
                    },
                },
            },
        });

        // Keep bids from any driver that exists.
        // Once a driver has submitted an offer, the rider must be able to see it
        // regardless of the driver's later online/availability/profile-status toggles.
        const activeBids = bids.filter((b) => b.driver);

        // Fallback: include driver who responded via `/rides/respond` or `/negotiation/propose`.
        // These flows set driverId directly on the ride without creating a RideRequestBid row.
        // Covers two sub-cases:
        //   A) Driver counter-offered (negotiatedFare != null, status = negotiating / pending)
        //   B) Driver directly accepted (status = accepted, driverId set, no bid row)
        let respondFlowOffer = null;
        if (booking.driverId) {
            const alreadyInBids = activeBids.some((b) => b.driverId === booking.driverId);
            if (!alreadyInBids) {
                const driver = await prisma.user.findUnique({
                    where: { id: booking.driverId },
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatar: true,
                        latitude: true,
                        longitude: true,
                        status: true,
                        isOnline: true,
                        isAvailable: true,
                        userDetail: { select: { carModel: true, carColor: true, carPlateNumber: true } },
                    },
                });

                // Show any driver who has explicitly set themselves on this ride.
                // If the backend accepted their offer already, rider must see it.
                if (driver) {
                    respondFlowOffer = {
                        id: `respond-${booking.id}-${driver.id}`,
                        // For direct-accept: show original fare; for negotiation: show proposed fare
                        bidAmount: booking.negotiatedFare ?? booking.totalAmount,
                        isDirectAccept: booking.negotiatedFare == null,
                        createdAt: booking.updatedAt,
                        driver,
                    };
                }
            }
        }

        const mergedOffers = respondFlowOffer ? [...activeBids, respondFlowOffer] : activeBids;

        if (mergedOffers.length === 0) {
            return res.json({
                success: true,
                message: 'No driver offers yet. Waiting for drivers to respond.',
                data: [],
            });
        }

        // Resolve driver ratings in one query (avoid N+1).
        const driverIds = Array.from(
            new Set(
                mergedOffers
                    .map((b) => b?.driver?.id)
                    .filter((id) => Number.isInteger(id) && id > 0)
            )
        );

        const ratingByDriverId = new Map();
        if (driverIds.length > 0) {
            const stats = await prisma.rideRequestRating.groupBy({
                by: ['driverId'],
                where: { driverId: { in: driverIds }, ratingBy: 'rider' },
                _avg: { rating: true },
                _count: { rating: true },
            });

            stats.forEach((s) => {
                ratingByDriverId.set(s.driverId, {
                    avg: s._avg.rating != null ? Math.round(Number(s._avg.rating) * 100) / 100 : null,
                    count: s._count.rating ?? 0,
                });
            });
        }

        const data = mergedOffers.map((b) => {
            const d = b.driver;
            const lat = d.latitude;
            const lng = d.longitude;
            const distanceKm =
                bookingCoords && lat != null && lng != null
                    ? haversineKm(bookingCoords.lat, bookingCoords.lng, parseFloat(lat), parseFloat(lng))
                    : null;

            return {
                id: d.id,
                name: `${d.firstName || ''} ${d.lastName || ''}`.trim(),
                avatar: fullImageUrl(req, d.avatar),
                rate: ratingByDriverId.get(d.id)?.avg ?? null,
                totalRatings: ratingByDriverId.get(d.id)?.count ?? 0,
                offeredPrice: parseFloat(b.bidAmount),
                basePrice: parseFloat(booking.totalAmount),
                isDirectAccept: b.isDirectAccept ?? false,
                vehicleType: d.userDetail?.carModel ?? 'Vehicle',
                carColor: d.userDetail?.carColor ?? null,
                carPlate: d.userDetail?.carPlateNumber ?? null,
                currentLocation: { lat, lng },
                distanceKm: Number.isFinite(distanceKm) ? Math.round(distanceKm * 100) / 100 : null,
                respondedAt: b.createdAt,
            };
        });

        return res.json({ success: true, message: 'Driver offers received', data });
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

        if (!['pending', 'accepted', 'negotiating', 'scheduled'].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot accept driver on a ride with status '${booking.status}'`,
            });
        }

        const tripCode = `TRP${Date.now()}`;

        const updated = await prisma.rideRequest.update({
            where: { id: rideId },
            data: {
                driverId,
                status: 'accepted',
                negotiationStatus: booking.negotiationStatus === 'pending' ? 'accepted' : booking.negotiationStatus,
                otp: booking.otp || tripCode.slice(-6),
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
                tripStatus: { status: 'accepted' },
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
        const { driver_id, booking_id, reason } = req.body;
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

        if (booking.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Cannot cancel a completed trip' });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Trip is already cancelled' });
        }

        await prisma.rideRequest.update({
            where: { id: rideId },
            data: { status: 'cancelled', cancelBy: 'rider', reason: reason || null },
        });

        // Notify driver
        const io = req.app.get('io');
        if (io && driverId) {
            io.to(`driver-${driverId}`).emit('trip-cancelled', { booking_id: rideId, cancelled_by: 'rider', reason });
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

const ACTIVE_RIDE_STATUSES = ['pending', 'accepted', 'arrived', 'arrived_at_pickup', 'in_progress', 'ongoing', 'started', 'negotiating'];

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
