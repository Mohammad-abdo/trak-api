import prisma from "../utils/prisma.js";

// @desc    Get surge price list
// @route   GET /api/surge-prices
// @access  Private (Admin)
export const getSurgePriceList = async (req, res) => {
    try {
        const { region_id, service_id, vehicle_category_id } = req.query;

        const where = {};
        if (region_id) where.regionId = parseInt(region_id);
        if (service_id) where.serviceId = parseInt(service_id);
        if (vehicle_category_id) where.vehicleCategoryId = parseInt(vehicle_category_id);

        const surgePrices = await prisma.surgePrice.findMany({
            where,
            include: {
                region: {
                    select: { id: true, name: true, nameAr: true },
                },
                service: {
                    select: { id: true, name: true, nameAr: true },
                },
                vehicleCategory: {
                    select: { id: true, name: true, nameAr: true, slug: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: surgePrices,
        });
    } catch (error) {
        console.error("Get surge price list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create surge price
// @route   POST /api/surge-prices
// @access  Private (Admin)
function parseJsonField(val) {
    if (val == null || val === '') return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (_) { return null; }
}

export const createSurgePrice = async (req, res) => {
    try {
        const { region_id, service_id, vehicle_category_id, day, type, value, from_time, to_time } =
            req.body;

        const data = {
            day: parseJsonField(day),
            type: type || 'percentage',
            value: value != null && value !== '' ? parseFloat(value) : null,
            fromTime: parseJsonField(from_time),
            toTime: parseJsonField(to_time),
        };
        if (region_id) data.region = { connect: { id: parseInt(region_id) } };
        if (service_id) data.service = { connect: { id: parseInt(service_id) } };
        if (vehicle_category_id) data.vehicleCategory = { connect: { id: parseInt(vehicle_category_id) } };

        const surgePrice = await prisma.surgePrice.create({
            data,
        });

        res.status(201).json({
            success: true,
            data: surgePrice,
            message: "Surge price created successfully",
        });
    } catch (error) {
        console.error("Create surge price error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update surge price
// @route   PUT /api/surge-prices/:id
// @access  Private (Admin)
export const updateSurgePrice = async (req, res) => {
    try {
        const { id } = req.params;
        const { region_id, service_id, vehicle_category_id, day, type, value, from_time, to_time } =
            req.body;

        const updateData = {};
        if (region_id !== undefined) updateData.region = region_id ? { connect: { id: parseInt(region_id) } } : { disconnect: true };
        if (service_id !== undefined) updateData.service = service_id ? { connect: { id: parseInt(service_id) } } : { disconnect: true };
        if (vehicle_category_id !== undefined) updateData.vehicleCategory = vehicle_category_id ? { connect: { id: parseInt(vehicle_category_id) } } : { disconnect: true };
        if (day !== undefined) updateData.day = parseJsonField(day);
        if (type !== undefined) updateData.type = type;
        if (value !== undefined) updateData.value = value != null && value !== '' ? parseFloat(value) : null;
        if (from_time !== undefined) updateData.fromTime = parseJsonField(from_time);
        if (to_time !== undefined) updateData.toTime = parseJsonField(to_time);

        const surgePrice = await prisma.surgePrice.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: surgePrice,
            message: "Surge price updated successfully",
        });
    } catch (error) {
        console.error("Update surge price error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete surge price
// @route   DELETE /api/surge-prices/:id
// @access  Private (Admin)
export const deleteSurgePrice = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.surgePrice.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Surge price deleted successfully",
        });
    } catch (error) {
        console.error("Delete surge price error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



