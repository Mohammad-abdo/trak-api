import prisma from '../../utils/prisma.js';
import { fullImageUrl } from '../../utils/imageUrl.js';
import { calculateDistance, calculateTripPrice } from '../../utils/pricingCalculator.js';

// @desc    Get vehicle types by service_id
// @route   GET /apimobile/user/booking/vehicle-types/:serviceId
// @access  Private
export const serviceVehicleTypes = async (req, res) => {
    try {
        const serviceId = parseInt(req.params.serviceId);

        const vehicleTypes = await prisma.vehicleCategory.findMany({
            where: {
                serviceCategory: { status: 1 },
                status: 1,
                serviceCategoryId: serviceId,
            },
            select: {
                id: true,
                name: true,
                nameAr: true,
                image: true,
                icon: true,
                capacity: true,
                maxLoad: true,
                pricingRules: {
                    where: { status: 1 },
                    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
                    select: {
                        id: true,
                        baseFare: true,
                        minimumFare: true,
                        baseDistance: true,
                        perDistanceAfterBase: true,
                        perMinuteDrive: true,
                        perMinuteWait: true,
                        cancellationFee: true,
                    },
                    take: 1,
                },
            },
        });

        const data = vehicleTypes.map(v => ({
            vehicle_id: v.id,
            type: v.name,
            name: v.name,
            nameAr: v.nameAr,
            image: fullImageUrl(req, v.image),
            icon: v.icon,
            capacity: v.capacity,
            maxLoad: v.maxLoad,
            price: v.pricingRules[0]?.baseFare ?? 0,
            pricingRule: v.pricingRules[0] ?? null,
        }));

        return res.json({ success: true, message: 'Vehicle types retrieved', data });
    } catch (error) {
        console.error('Service vehicle types error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get vehicle types' });
    }
};

// @desc    Get shipment sizes for a vehicle category
// @route   GET /apimobile/user/booking/shipment-sizes
// @access  Private
export const getShipmentSizes = async (req, res) => {
    try {
        const { vehicleCategoryId } = req.query;

        const where = vehicleCategoryId ? { status: 1, vehicleCategoryId: parseInt(vehicleCategoryId) } : { status: 1 };

        const sizes = await prisma.shipmentSize.findMany({
            where,
            select: {
                id: true,
                vehicleCategoryId: true,
                name: true,
                priceModifier: true,
            },
        });

        const data = sizes.map(s => ({
            shipmentSize_id: s.id,
            id: s.id,
            vehicle_id: s.vehicleCategoryId,
            vehicleCategoryId: s.vehicleCategoryId,
            name: s.name,
            price: s.priceModifier ?? 0,
            priceModifier: s.priceModifier ?? 0,
        }));

        return res.json({ success: true, message: 'Shipment sizes retrieved', data });
    } catch (error) {
        console.error('Shipment sizes error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get shipment sizes' });
    }
};

// @desc    Get shipment weights for a vehicle category
// @route   GET /apimobile/user/booking/shipment-weights
// @access  Private
export const getShipmentWeights = async (req, res) => {
    try {
        const { vehicleCategoryId } = req.query;

        const where = vehicleCategoryId ? { status: 1, vehicleCategoryId: parseInt(vehicleCategoryId) } : { status: 1 };

        const weights = await prisma.shipmentWeight.findMany({
            where,
            select: {
                id: true,
                vehicleCategoryId: true,
                name: true,
                priceModifier: true,
            },
        });

        const data = weights.map(w => ({
            shipmentWeight_id: w.id,
            id: w.id,
            vehicle_id: w.vehicleCategoryId,
            vehicleCategoryId: w.vehicleCategoryId,
            name: w.name,
            price: w.priceModifier ?? 0,
            priceModifier: w.priceModifier ?? 0,
        }));

        return res.json({ success: true, message: 'Shipment weights retrieved', data });
    } catch (error) {
        console.error('Shipment weights error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get shipment weights' });
    }
};

// @desc    Get payment methods (from payment_methods table)
// @route   GET /apimobile/user/booking/payment-methods
// @access  Private
export const getPaymentMethods = async (req, res) => {
    try {
        const methods = await prisma.paymentMethod.findMany({
            where: { status: 1 },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            select: { id: true, name: true, nameAr: true, code: true },
        });

        const data = methods.map((m) => ({
            payment_id: m.id,
            name: m.name,
            nameAr: m.nameAr,
            type: m.code,
        }));

        return res.json({ success: true, message: 'Payment methods retrieved', data });
    } catch (error) {
        console.error('Payment methods error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get payment methods' });
    }
};

// @desc    Create a new booking
// @route   POST /apimobile/user/booking/create
// @access  Private
export const createBooking = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            vehicle_id,
            shipmentSize_id,
            shipmentWeight_id,
            paymentMethod,
            from,
            to,
            bookingType,
            isSpecial,
            scheduledAt,
            scheduleDatetime,
        } = req.body;

        if (!vehicle_id || !from || !to) {
            return res.status(400).json({ success: false, message: 'vehicle_id, from and to are required' });
        }
        const vehicleId = parseInt(vehicle_id, 10);
        if (Number.isNaN(vehicleId)) {
            return res.status(400).json({ success: false, message: 'Invalid vehicle_id' });
        }

        // Get vehicle category to find a linked service
        const vehicleCategory = await prisma.vehicleCategory.findUnique({
            where: { id: vehicleId },
            include: { serviceCategory: true },
        });

        if (!vehicleCategory) {
            return res.status(404).json({ success: false, message: 'Vehicle category not found' });
        }

        // Resolve an active Service for this vehicle category (RideRequest.serviceId references Service).
        // Do NOT use serviceCategoryId here.
        const resolvedService = await prisma.service.findFirst({
            where: { vehicleCategoryId: vehicleId, status: 1 },
            select: { id: true, name: true, nameAr: true },
            orderBy: [{ id: 'asc' }],
        });

        const tripOtp = Math.floor(1000 + Math.random() * 9000).toString();

        // Get size/weight modifiers
        let sizeModifier = 0;
        let weightModifier = 0;
        let resolvedSize = null;
        let resolvedWeight = null;

        if (shipmentSize_id) {
            const sizeId = parseInt(shipmentSize_id, 10);
            if (Number.isNaN(sizeId)) {
                return res.status(400).json({ success: false, message: 'Invalid shipmentSize_id' });
            }
            const size = await prisma.shipmentSize.findFirst({
                where: { id: sizeId, vehicleCategoryId: vehicleId, status: 1 },
            });
            if (!size) {
                return res.status(400).json({ success: false, message: 'Invalid shipment size for selected vehicle category' });
            }
            sizeModifier = size?.priceModifier ?? 0;
            resolvedSize = size;
        }
        if (shipmentWeight_id) {
            const weightId = parseInt(shipmentWeight_id, 10);
            if (Number.isNaN(weightId)) {
                return res.status(400).json({ success: false, message: 'Invalid shipmentWeight_id' });
            }
            const weight = await prisma.shipmentWeight.findFirst({
                where: { id: weightId, vehicleCategoryId: vehicleId, status: 1 },
            });
            if (!weight) {
                return res.status(400).json({ success: false, message: 'Invalid shipment weight for selected vehicle category' });
            }
            weightModifier = weight?.priceModifier ?? 0;
            resolvedWeight = weight;
        }

        // Build price using the shared pricing calculator (distance-based + minimum fare),
        // then add shipment modifiers.
        const distanceKm = calculateDistance(
            parseFloat(from.lat),
            parseFloat(from.lng),
            parseFloat(to.lat),
            parseFloat(to.lng)
        );

        const priceResult = await calculateTripPrice(vehicleId, distanceKm, 0, 0);
        if (!priceResult?.success) {
            return res.status(422).json({
                success: false,
                message: priceResult?.error || 'Unable to calculate trip price for selected vehicle category',
            });
        }

        const calculatedTotal = (priceResult.totalAmount ?? 0) + sizeModifier + weightModifier;

        // Backward-compatible booking type handling:
        // - normal (default): immediate trip
        // - special: scheduled trip in the future
        const typeRaw = String(bookingType ?? "").toLowerCase().trim();
        const specialFlag = isSpecial === true || typeRaw === "special" || typeRaw === "scheduled";
        const requestedSchedule = scheduledAt ?? scheduleDatetime ?? null;
        let scheduledDate = null;

        if (specialFlag) {
            if (!requestedSchedule) {
                return res.status(400).json({
                    success: false,
                    message: "scheduledAt (or scheduleDatetime) is required for special booking",
                });
            }

            const parsed = new Date(requestedSchedule);
            if (Number.isNaN(parsed.getTime())) {
                return res.status(422).json({ success: false, message: "Invalid scheduleDatetime/scheduledAt" });
            }

            const now = new Date();
            const minAdvanceMs = 30 * 60 * 1000; // 30 minutes
            if (parsed.getTime() - now.getTime() < minAdvanceMs) {
                return res.status(422).json({
                    success: false,
                    message: "Scheduled time must be at least 30 minutes from now",
                });
            }

            scheduledDate = parsed;
        }

        const booking = await prisma.rideRequest.create({
            data: {
                riderId: userId,
                vehicleCategoryId: vehicleId,
                serviceId: resolvedService?.id ?? null,
                startLatitude: String(from.lat),
                startLongitude: String(from.lng),
                startAddress: from.address || '',
                endLatitude: String(to.lat),
                endLongitude: String(to.lng),
                endAddress: to.address || '',
                paymentType: paymentMethod === 0 || paymentMethod === 'cash' ? 'cash' : `gateway_${paymentMethod}`,
                totalAmount: calculatedTotal,
                subtotal: calculatedTotal,
                distance: distanceKm,
                baseFare: priceResult.breakdown?.baseFare ?? 0,
                minimumFare: priceResult.breakdown?.minimumFare ?? 0,
                perDistance: priceResult.breakdown?.perKmRate ?? 0,
                perMinuteDrive: 0,
                status: specialFlag ? 'scheduled' : 'pending',
                isSchedule: specialFlag,
                scheduleDatetime: specialFlag ? scheduledDate : null,
                datetime: specialFlag ? scheduledDate : new Date(),
                otp: tripOtp,
                serviceData: {
                    vehicleCategoryId: vehicleId,
                    vehicleCategoryName: vehicleCategory.name,
                    serviceCategoryId: vehicleCategory.serviceCategoryId,
                    serviceCategoryName: vehicleCategory.serviceCategory?.name || null,
                    resolvedServiceId: resolvedService?.id ?? null,
                    shipmentSizeId: shipmentSize_id ?? null,
                    shipmentWeightId: shipmentWeight_id ?? null,
                    bookingType: specialFlag ? 'special' : 'normal',
                    distanceKm,
                    pricing: priceResult.breakdown ?? null,
                },
            },
            select: {
                id: true,
                status: true,
                isSchedule: true,
                scheduleDatetime: true,
                totalAmount: true,
                baseFare: true,
                minimumFare: true,
                perDistance: true,
                perMinuteDrive: true,
                vehicleCategoryId: true,
                serviceId: true,
                paymentType: true,
                otp: true,
                startLatitude: true,
                startLongitude: true,
                startAddress: true,
                endLatitude: true,
                endLongitude: true,
                endAddress: true,
                createdAt: true,
            },
        });

        return res.status(201).json({
            success: true,
            message: specialFlag ? "Booking scheduled" : "Booking created",
            data: {
                booking_id: booking.id,
                status: booking.status,
                bookingType: specialFlag ? 'special' : 'normal',
                isSpecial: specialFlag,
                isScheduled: booking.isSchedule,
                scheduledAt: booking.scheduleDatetime,
                totalAmount: booking.totalAmount,
                paymentType: booking.paymentType,
                tripOtp: booking.otp,
                from: { lat: booking.startLatitude, lng: booking.startLongitude, address: booking.startAddress },
                to: { lat: booking.endLatitude, lng: booking.endLongitude, address: booking.endAddress },
                createdAt: booking.createdAt,
                vehicleCategory: {
                    id: booking.vehicleCategoryId,
                    name: vehicleCategory.name,
                    nameAr: vehicleCategory.nameAr,
                },
                service: {
                    id: booking.serviceId,
                    name: resolvedService?.name || null,
                    nameAr: resolvedService?.nameAr || null,
                },
                pricing: {
                    baseFare: booking.baseFare,
                    minimumFare: booking.minimumFare,
                    perDistance: booking.perDistance,
                    perMinuteDrive: booking.perMinuteDrive,
                    shipmentSizeModifier: sizeModifier,
                    shipmentWeightModifier: weightModifier,
                    totalAmount: booking.totalAmount,
                    currency: priceResult.currency ?? null,
                    distanceKm,
                    breakdown: priceResult.breakdown ?? null,
                },
                shipment: {
                    shipmentSize_id: resolvedSize?.id ?? (shipmentSize_id ? parseInt(shipmentSize_id, 10) : null),
                    shipmentSizeName: resolvedSize?.name ?? null,
                    shipmentSizePrice: resolvedSize?.priceModifier ?? 0,
                    shipmentWeight_id: resolvedWeight?.id ?? (shipmentWeight_id ? parseInt(shipmentWeight_id, 10) : null),
                    shipmentWeightName: resolvedWeight?.name ?? null,
                    shipmentWeightPrice: resolvedWeight?.priceModifier ?? 0,
                },
            },
        });
    } catch (error) {
        console.error('Create booking error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to create booking' });
    }
};
