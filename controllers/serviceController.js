import prisma from "../utils/prisma.js";
import { calculateTripPrice } from "../utils/pricingCalculator.js";
// Import vehicle search if needed, or we rely on vehicleCategoryController for search


// @desc    Get service list
// @route   GET /api/services/service-list
// @access  Public
export const getServiceList = async (req, res) => {
    try {
        const { status, region_id } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }
        if (region_id) {
            where.regionId = parseInt(region_id);
        }

        const services = await prisma.service.findMany({
            where,
            include: {
                region: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: services,
        });
    } catch (error) {
        console.error("Get service list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get service detail
// @route   GET /api/services/:id
// @access  Public
export const getServiceDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const service = await prisma.service.findUnique({
            where: { id: parseInt(id) },
            include: {
                region: true,
            },
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found",
            });
        }

        res.json({
            success: true,
            data: service,
        });
    } catch (error) {
        console.error("Get service detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create service
// @route   POST /api/services
// @access  Private (Admin)
export const createService = async (req, res) => {
    try {
        const {
            name,
            region_id,
            capacity,
            base_fare,
            minimum_fare,
            minimum_distance,
            per_distance,
            per_minute_drive,
            per_minute_wait,
            waiting_time_limit,
            payment_method,
            commission_type,
            admin_commission,
            fleet_commission,
            status,
            cancellation_fee,
            description,
        } = req.body;

        const service = await prisma.service.create({
            data: {
                name,
                nameAr: name_ar,
                regionId: region_id ? parseInt(region_id) : null,
                capacity: capacity ? parseInt(capacity) : null,
                baseFare: base_fare ? parseFloat(base_fare) : 0,
                minimumFare: minimum_fare ? parseFloat(minimum_fare) : 0,
                minimumDistance: minimum_distance ? parseFloat(minimum_distance) : 0,
                perDistance: per_distance ? parseFloat(per_distance) : 0,
                perMinuteDrive: per_minute_drive ? parseFloat(per_minute_drive) : 0,
                perMinuteWait: per_minute_wait ? parseFloat(per_minute_wait) : 0,
                waitingTimeLimit: waiting_time_limit ? parseFloat(waiting_time_limit) : 0,
                paymentMethod: payment_method,
                commissionType: commission_type,
                adminCommission: admin_commission ? parseFloat(admin_commission) : 0,
                fleetCommission: fleet_commission ? parseFloat(fleet_commission) : 0,
                status: status !== undefined ? parseInt(status) : 1,
                cancellationFee: cancellation_fee ? parseFloat(cancellation_fee) : 0,
                description,
                descriptionAr: description_ar,
            },
        });

        res.status(201).json({
            success: true,
            data: service,
            message: "Service created successfully",
        });
    } catch (error) {
        console.error("Create service error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Admin)
export const updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            name_ar,
            region_id,
            capacity,
            base_fare,
            minimum_fare,
            minimum_distance,
            per_distance,
            per_minute_drive,
            per_minute_wait,
            waiting_time_limit,
            payment_method,
            commission_type,
            admin_commission,
            fleet_commission,
            status,
            cancellation_fee,
            description,
            description_ar,
        } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (name_ar !== undefined) updateData.nameAr = name_ar;
        if (region_id !== undefined) updateData.regionId = region_id ? parseInt(region_id) : null;
        if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
        if (base_fare !== undefined) updateData.baseFare = parseFloat(base_fare);
        if (minimum_fare !== undefined) updateData.minimumFare = parseFloat(minimum_fare);
        if (minimum_distance !== undefined) updateData.minimumDistance = parseFloat(minimum_distance);
        if (per_distance !== undefined) updateData.perDistance = parseFloat(per_distance);
        if (per_minute_drive !== undefined) updateData.perMinuteDrive = parseFloat(per_minute_drive);
        if (per_minute_wait !== undefined) updateData.perMinuteWait = parseFloat(per_minute_wait);
        if (waiting_time_limit !== undefined) updateData.waitingTimeLimit = parseFloat(waiting_time_limit);
        if (payment_method) updateData.paymentMethod = payment_method;
        if (commission_type) updateData.commissionType = commission_type;
        if (admin_commission !== undefined) updateData.adminCommission = parseFloat(admin_commission);
        if (fleet_commission !== undefined) updateData.fleetCommission = parseFloat(fleet_commission);
        if (status !== undefined) updateData.status = parseInt(status);
        if (cancellation_fee !== undefined) updateData.cancellationFee = parseFloat(cancellation_fee);
        if (description !== undefined) updateData.description = description;
        if (description_ar !== undefined) updateData.descriptionAr = description_ar;

        const service = await prisma.service.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: service,
            message: "Service updated successfully",
        });
    } catch (error) {
        console.error("Update service error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete service
// @route   DELETE /api/services/:id
// @access  Private (Admin)
export const deleteService = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.service.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Service deleted successfully",
        });
    } catch (error) {
        console.error("Delete service error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Estimate price and time
// @route   POST /api/services/estimate-price-time
// @access  Public
export const estimatePriceTime = async (req, res) => {
    try {
        if (req.body.vehicleCategoryId) {
            // New Logic: Use Pricing Calculator Utility
            const { vehicleCategoryId, distance, duration } = req.body;

            const priceResult = await calculateTripPrice(
                vehicleCategoryId,
                parseFloat(distance),
                parseFloat(duration)
            );

            if (!priceResult.success) {
                return res.status(400).json({
                    success: false,
                    message: priceResult.error
                });
            }

            return res.json({
                success: true,
                data: {
                    estimatedPrice: priceResult.totalAmount,
                    estimatedTime: duration,
                    distance,
                    breakdown: priceResult.breakdown,
                    vehicleCategory: priceResult.vehicleCategory
                }
            });
        }

        // Legacy Logic
        const { serviceId, distance, duration } = req.body;

        const service = await prisma.service.findUnique({
            where: { id: serviceId },
        });

        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found",
            });
        }

        const baseFare = service.baseFare || 0;
        const perDistanceCharge =
            (distance - (service.minimumDistance || 0)) *
            (service.perDistance || 0);
        const perMinuteCharge = duration * (service.perMinuteDrive || 0);
        const subtotal = baseFare + perDistanceCharge + perMinuteCharge;
        const totalAmount = Math.max(subtotal, service.minimumFare || 0);

        res.json({
            success: true,
            data: {
                estimatedPrice: totalAmount,
                estimatedTime: duration,
                distance,
                baseFare,
                perDistanceCharge,
                perMinuteCharge,
            },
        });
    } catch (error) {
        console.error("Estimate price time error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
