import prisma from "../utils/prisma.js";

// @desc    Get coupon list
// @route   GET /api/coupons/coupon-list
// @access  Private
export const getCouponList = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const coupons = await prisma.coupon.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: coupons,
        });
    } catch (error) {
        console.error("Get coupon list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get coupon detail
// @route   GET /api/coupons/:id
// @access  Private (Admin)
export const getCouponDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await prisma.coupon.findUnique({
            where: { id: parseInt(id) },
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            });
        }

        res.json({
            success: true,
            data: coupon,
        });
    } catch (error) {
        console.error("Get coupon detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create coupon
// @route   POST /api/coupons
// @access  Private (Admin)
export const createCoupon = async (req, res) => {
    try {
        const {
            code,
            discount_type,
            discount,
            expiry_date,
            usage_limit,
            usage_limit_per_rider,
            min_amount,
            max_discount,
            coupon_type,
            service_ids,
            region_ids,
            status,
        } = req.body;

        // Check if coupon code exists
        const existingCoupon = await prisma.coupon.findFirst({
            where: { code },
        });

        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "Coupon code already exists",
            });
        }

        const coupon = await prisma.coupon.create({
            data: {
                code,
                discountType: discount_type,
                discount: discount ? parseFloat(discount) : 0,
                expiryDate: expiry_date ? new Date(expiry_date) : null,
                usageLimit: usage_limit ? parseInt(usage_limit) : null,
                usageLimitPerRider: usage_limit_per_rider ? parseInt(usage_limit_per_rider) : null,
                minAmount: min_amount ? parseFloat(min_amount) : null,
                maxDiscount: max_discount ? parseFloat(max_discount) : null,
                couponType: coupon_type,
                serviceIds: service_ids ? JSON.stringify(service_ids) : null,
                regionIds: region_ids ? JSON.stringify(region_ids) : null,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: coupon,
            message: "Coupon created successfully",
        });
    } catch (error) {
        console.error("Create coupon error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update coupon
// @route   PUT /api/coupons/:id
// @access  Private (Admin)
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            code,
            discount_type,
            discount,
            expiry_date,
            usage_limit,
            usage_limit_per_rider,
            min_amount,
            max_discount,
            coupon_type,
            service_ids,
            region_ids,
            status,
        } = req.body;

        const updateData = {};
        if (code) updateData.code = code;
        if (discount_type) updateData.discountType = discount_type;
        if (discount !== undefined) updateData.discount = parseFloat(discount);
        if (expiry_date) updateData.expiryDate = new Date(expiry_date);
        if (usage_limit !== undefined) updateData.usageLimit = usage_limit ? parseInt(usage_limit) : null;
        if (usage_limit_per_rider !== undefined) updateData.usageLimitPerRider = usage_limit_per_rider ? parseInt(usage_limit_per_rider) : null;
        if (min_amount !== undefined) updateData.minAmount = min_amount ? parseFloat(min_amount) : null;
        if (max_discount !== undefined) updateData.maxDiscount = max_discount ? parseFloat(max_discount) : null;
        if (coupon_type) updateData.couponType = coupon_type;
        if (service_ids) updateData.serviceIds = JSON.stringify(service_ids);
        if (region_ids) updateData.regionIds = JSON.stringify(region_ids);
        if (status !== undefined) updateData.status = parseInt(status);

        const coupon = await prisma.coupon.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: coupon,
            message: "Coupon updated successfully",
        });
    } catch (error) {
        console.error("Update coupon error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete coupon
// @route   DELETE /api/coupons/:id
// @access  Private (Admin)
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.coupon.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Coupon deleted successfully",
        });
    } catch (error) {
        console.error("Delete coupon error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

