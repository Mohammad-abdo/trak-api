import prisma from '../../utils/prisma.js';

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
            image: v.image,
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
            vehicle_id: s.vehicleCategoryId,
            id: s.id,
            name: s.name,
            price: s.priceModifier,
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
            vehicle_id: w.vehicleCategoryId,
            id: w.id,
            name: w.name,
            price: w.priceModifier,
        }));

        return res.json({ success: true, message: 'Shipment weights retrieved', data });
    } catch (error) {
        console.error('Shipment weights error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get shipment weights' });
    }
};

// @desc    Get payment methods
// @route   GET /apimobile/user/booking/payment-methods
// @access  Private
export const getPaymentMethods = async (req, res) => {
    try {
        const gateways = await prisma.paymentGateway.findMany({
            where: { status: 1 },
            select: { id: true, title: true, type: true },
        });

        // Always include cash
        const methods = [
            { payment_id: 0, name: 'Cash', type: 'cash' },
            ...gateways.map(g => ({ payment_id: g.id, name: g.title, type: g.type })),
        ];

        return res.json({ success: true, message: 'Payment methods retrieved', data: methods });
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
            totalPrice,
        } = req.body;

        if (!vehicle_id || !from || !to) {
            return res.status(400).json({ success: false, message: 'vehicle_id, from and to are required' });
        }

        // Get vehicle category to find a linked service
        const vehicleCategory = await prisma.vehicleCategory.findUnique({
            where: { id: parseInt(vehicle_id) },
            include: { serviceCategory: true },
        });

        if (!vehicleCategory) {
            return res.status(404).json({ success: false, message: 'Vehicle category not found' });
        }

        // Get pricing rule for this vehicle
        const pricingRule = await prisma.pricingRule.findFirst({
            where: { vehicleCategoryId: parseInt(vehicle_id), status: 1 },
        });

        const tripOtp = Math.floor(1000 + Math.random() * 9000).toString();

        // Get size/weight modifiers
        let sizeModifier = 0;
        let weightModifier = 0;

        if (shipmentSize_id) {
            const size = await prisma.shipmentSize.findUnique({ where: { id: parseInt(shipmentSize_id) } });
            sizeModifier = size?.priceModifier ?? 0;
        }
        if (shipmentWeight_id) {
            const weight = await prisma.shipmentWeight.findUnique({ where: { id: parseInt(shipmentWeight_id) } });
            weightModifier = weight?.priceModifier ?? 0;
        }

        const calculatedTotal = totalPrice ?? ((pricingRule?.baseFare ?? 0) + sizeModifier + weightModifier);

        const booking = await prisma.rideRequest.create({
            data: {
                riderId: userId,
                vehicleCategoryId: parseInt(vehicle_id),
                startLatitude: String(from.lat),
                startLongitude: String(from.lng),
                startAddress: from.address || '',
                endLatitude: String(to.lat),
                endLongitude: String(to.lng),
                endAddress: to.address || '',
                paymentType: paymentMethod === 0 || paymentMethod === 'cash' ? 'cash' : `gateway_${paymentMethod}`,
                totalAmount: calculatedTotal,
                subtotal: calculatedTotal,
                baseFare: pricingRule?.baseFare ?? 0,
                minimumFare: pricingRule?.minimumFare ?? 0,
                perDistance: pricingRule?.perDistanceAfterBase ?? 0,
                perMinuteDrive: pricingRule?.perMinuteDrive ?? 0,
                status: 'pending',
                otp: tripOtp,
                serviceData: {
                    vehicleCategoryId: vehicle_id,
                    vehicleCategoryName: vehicleCategory.name,
                    shipmentSizeId: shipmentSize_id ?? null,
                    shipmentWeightId: shipmentWeight_id ?? null,
                },
            },
            select: {
                id: true,
                status: true,
                totalAmount: true,
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
            message: 'Booking created successfully',
            data: {
                booking_id: booking.id,
                status: booking.status,
                totalAmount: booking.totalAmount,
                paymentType: booking.paymentType,
                tripOtp: booking.otp,
                from: { lat: booking.startLatitude, lng: booking.startLongitude, address: booking.startAddress },
                to: { lat: booking.endLatitude, lng: booking.endLongitude, address: booking.endAddress },
                createdAt: booking.createdAt,
            },
        });
    } catch (error) {
        console.error('Create booking error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to create booking' });
    }
};
