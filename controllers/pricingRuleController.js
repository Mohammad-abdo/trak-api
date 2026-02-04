import prisma from "../utils/prisma.js";

// @desc    Get all pricing rules
// @route   GET /api/pricing-rules
// @access  Public
export const getPricingRules = async (req, res) => {
    try {
        const { status, vehicle_category_id } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }
        if (vehicle_category_id) {
            where.vehicleCategoryId = parseInt(vehicle_category_id);
        }

        const rules = await prisma.pricingRule.findMany({
            where,
            include: {
                vehicleCategory: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        slug: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: rules,
        });
    } catch (error) {
        console.error("Get pricing rules error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get pricing rule by ID
// @route   GET /api/pricing-rules/:id
// @access  Public
export const getPricingRuleById = async (req, res) => {
    try {
        const { id } = req.params;

        const rule = await prisma.pricingRule.findUnique({
            where: { id: parseInt(id) },
            include: {
                vehicleCategory: true,
            },
        });

        if (!rule) {
            return res.status(404).json({
                success: false,
                message: "Pricing rule not found",
            });
        }

        res.json({
            success: true,
            data: rule,
        });
    } catch (error) {
        console.error("Get pricing rule by ID error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Calculate price based on distance and duration
// @route   POST /api/pricing-rules/calculate
// @access  Public
export const calculatePrice = async (req, res) => {
    try {
        const { vehicle_category_id, distance, duration } = req.body;

        if (!vehicle_category_id || distance === undefined || duration === undefined) {
            return res.status(400).json({
                success: false,
                message: "Vehicle category ID, distance, and duration are required",
            });
        }

        const rule = await prisma.pricingRule.findFirst({
            where: {
                vehicleCategoryId: parseInt(vehicle_category_id),
                status: 1,
            },
            include: {
                vehicleCategory: {
                    select: {
                        name: true,
                        nameAr: true,
                    },
                },
            },
        });

        if (!rule) {
            return res.status(404).json({
                success: false,
                message: "No pricing rule found for this vehicle category",
            });
        }

        const dist = parseFloat(distance);
        const dur = parseFloat(duration);

        // Calculate pricing based on 5km base distance
        let distanceCharge = 0;
        if (dist > rule.baseDistance) {
            const extraDistance = dist - rule.baseDistance;
            distanceCharge = extraDistance * rule.perDistanceAfterBase;
        }

        const timeCharge = dur * (rule.perMinuteDrive || 0);
        const subtotal = rule.baseFare + distanceCharge + timeCharge;
        const totalAmount = Math.max(subtotal, rule.minimumFare);

        res.json({
            success: true,
            data: {
                vehicleCategory: rule.vehicleCategory,
                distance: dist,
                duration: dur,
                breakdown: {
                    baseFare: rule.baseFare,
                    baseDistance: rule.baseDistance,
                    extraDistance: Math.max(0, dist - rule.baseDistance),
                    distanceCharge: distanceCharge,
                    timeCharge: timeCharge,
                    subtotal: subtotal,
                    minimumFare: rule.minimumFare,
                },
                totalAmount: totalAmount,
                pricing: {
                    baseFare: rule.baseFare,
                    perDistanceAfterBase: rule.perDistanceAfterBase,
                    perMinuteDrive: rule.perMinuteDrive,
                    perMinuteWait: rule.perMinuteWait,
                    cancellationFee: rule.cancellationFee,
                },
            },
        });
    } catch (error) {
        console.error("Calculate price error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create pricing rule
// @route   POST /api/pricing-rules
// @access  Private (Admin)
export const createPricingRule = async (req, res) => {
    try {
        const {
            vehicle_category_id,
            base_fare,
            base_distance,
            minimum_fare,
            per_distance_after_base,
            per_minute_drive,
            per_minute_wait,
            waiting_time_limit,
            cancellation_fee,
            commission_type,
            admin_commission,
            fleet_commission,
            status,
        } = req.body;

        const rule = await prisma.pricingRule.create({
            data: {
                vehicleCategoryId: parseInt(vehicle_category_id),
                baseFare: parseFloat(base_fare),
                baseDistance: base_distance ? parseFloat(base_distance) : 5.0,
                minimumFare: parseFloat(minimum_fare),
                perDistanceAfterBase: parseFloat(per_distance_after_base),
                perMinuteDrive: per_minute_drive ? parseFloat(per_minute_drive) : 0,
                perMinuteWait: per_minute_wait ? parseFloat(per_minute_wait) : 0,
                waitingTimeLimit: waiting_time_limit ? parseFloat(waiting_time_limit) : 0,
                cancellationFee: cancellation_fee ? parseFloat(cancellation_fee) : 0,
                commissionType: commission_type,
                adminCommission: admin_commission ? parseFloat(admin_commission) : 0,
                fleetCommission: fleet_commission ? parseFloat(fleet_commission) : 0,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: rule,
            message: "Pricing rule created successfully",
        });
    } catch (error) {
        console.error("Create pricing rule error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update pricing rule
// @route   PUT /api/pricing-rules/:id
// @access  Private (Admin)
export const updatePricingRule = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            vehicle_category_id,
            base_fare,
            base_distance,
            minimum_fare,
            per_distance_after_base,
            per_minute_drive,
            per_minute_wait,
            waiting_time_limit,
            cancellation_fee,
            commission_type,
            admin_commission,
            fleet_commission,
            status,
        } = req.body;

        const updateData = {};
        if (vehicle_category_id) updateData.vehicleCategoryId = parseInt(vehicle_category_id);
        if (base_fare !== undefined) updateData.baseFare = parseFloat(base_fare);
        if (base_distance !== undefined) updateData.baseDistance = parseFloat(base_distance);
        if (minimum_fare !== undefined) updateData.minimumFare = parseFloat(minimum_fare);
        if (per_distance_after_base !== undefined) updateData.perDistanceAfterBase = parseFloat(per_distance_after_base);
        if (per_minute_drive !== undefined) updateData.perMinuteDrive = parseFloat(per_minute_drive);
        if (per_minute_wait !== undefined) updateData.perMinuteWait = parseFloat(per_minute_wait);
        if (waiting_time_limit !== undefined) updateData.waitingTimeLimit = parseFloat(waiting_time_limit);
        if (cancellation_fee !== undefined) updateData.cancellationFee = parseFloat(cancellation_fee);
        if (commission_type) updateData.commissionType = commission_type;
        if (admin_commission !== undefined) updateData.adminCommission = parseFloat(admin_commission);
        if (fleet_commission !== undefined) updateData.fleetCommission = parseFloat(fleet_commission);
        if (status !== undefined) updateData.status = parseInt(status);

        const rule = await prisma.pricingRule.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: rule,
            message: "Pricing rule updated successfully",
        });
    } catch (error) {
        console.error("Update pricing rule error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete pricing rule
// @route   DELETE /api/pricing-rules/:id
// @access  Private (Admin)
export const deletePricingRule = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.pricingRule.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Pricing rule deleted successfully",
        });
    } catch (error) {
        console.error("Delete pricing rule error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
