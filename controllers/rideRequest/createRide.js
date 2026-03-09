import prisma from "../../utils/prisma.js";
import { calculateTripPrice } from "../../utils/pricingCalculator.js";
import * as promotionService from "../../services/promotionService.js";

// @desc    Create ride request
// @route   POST /api/ride-requests/save-riderequest
// @access  Private
export const createRideRequest = async (req, res) => {
    try {
        const {
            serviceId,
            vehicleCategoryId,
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
            startAddress,
            endAddress,
            distance,
            duration,
            isSchedule,
            scheduleDatetime,
            paymentType,
            couponCode,
            seatCount,
            dropLocation,
        } = req.body;

        let rideData = {
            riderId: req.user.id,
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
            startAddress,
            endAddress,
            distance,
            duration,
            isSchedule,
            scheduleDatetime: scheduleDatetime ? new Date(scheduleDatetime) : null,
            paymentType: paymentType || "cash",
            seatCount: seatCount || 1,
            dropLocation: dropLocation ? JSON.parse(JSON.stringify(dropLocation)) : null,
        };

        if (vehicleCategoryId) {
            const priceResult = await calculateTripPrice(
                vehicleCategoryId,
                parseFloat(distance),
                parseFloat(duration)
            );

            if (!priceResult.success) {
                return res.status(400).json({ success: false, message: priceResult.error });
            }

            const vehicleCategory = await prisma.vehicleCategory.findUnique({
                where: { id: parseInt(vehicleCategoryId) },
                include: { serviceCategory: true },
            });

            rideData = {
                ...rideData,
                vehicleCategoryId: parseInt(vehicleCategoryId),
                baseFare: priceResult.breakdown.baseFare,
                minimumFare: priceResult.breakdown.minimumFare,
                baseDistance: priceResult.breakdown.baseDistance,
                perDistance: priceResult.breakdown.perKmRate,
                perDistanceCharge: priceResult.breakdown.distanceCharge,
                perMinuteDrive: 0,
                subtotal: priceResult.totalAmount,
                totalAmount: priceResult.totalAmount,
                pricingData: JSON.stringify(priceResult.breakdown),
                serviceData: JSON.stringify({
                    name: vehicleCategory.name,
                    id: vehicleCategory.serviceCategoryId,
                }),
                serviceId: vehicleCategory.serviceCategoryId,
            };
        } else if (serviceId) {
            const service = await prisma.service.findUnique({ where: { id: serviceId } });

            if (!service) {
                return res.status(404).json({ success: false, message: "Service not found" });
            }

            const baseFare = service.baseFare || 0;
            const perDistanceCharge = (distance - (service.minimumDistance || 0)) * (service.perDistance || 0);
            const perMinuteCharge = duration * (service.perMinuteDrive || 0);
            const subtotal = baseFare + perDistanceCharge + perMinuteCharge;
            const totalAmount = Math.max(subtotal, service.minimumFare || 0);

            rideData = {
                ...rideData,
                serviceId,
                baseFare,
                minimumFare: service.minimumFare,
                baseDistance: service.minimumDistance,
                perDistance: service.perDistance,
                perDistanceCharge,
                perMinuteDrive: service.perMinuteDrive,
                subtotal,
                totalAmount,
                serviceData: JSON.parse(JSON.stringify(service)),
            };
        } else {
            return res.status(400).json({ success: false, message: "Either serviceId or vehicleCategoryId is required" });
        }

        // Apply promotion (coupon) if provided
        const promotionResult = await promotionService.applyPromotion({
            userId: req.user.id,
            bookingType: "RIDE",
            vehicleCategoryId: rideData.vehicleCategoryId || null,
            totalPrice: rideData.totalAmount,
            bookingDate: rideData.scheduleDatetime || new Date(),
            code: couponCode || null,
        });
        if (promotionResult.applied) {
            rideData.totalAmount = promotionResult.finalPrice;
            rideData.couponDiscount = promotionResult.discount;
            rideData.couponData = promotionResult.promotion ? JSON.stringify(promotionResult.promotion) : null;
        }

        const rideRequest = await prisma.rideRequest.create({ data: rideData });

        if (promotionResult.applied && promotionResult.promotion?.id) {
            await promotionService.recordPromotionUsage(promotionResult.promotion.id, req.user.id, String(rideRequest.id));
        }

        res.status(201).json({ success: true, message: "Ride request created successfully", data: rideRequest });
    } catch (error) {
        console.error("Create ride request error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
