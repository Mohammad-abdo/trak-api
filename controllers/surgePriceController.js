import prisma from "../utils/prisma.js";

// @desc    Get surge price list
// @route   GET /api/surge-prices
// @access  Private (Admin)
export const getSurgePriceList = async (req, res) => {
    try {
        const { region_id, service_id } = req.query;

        const where = {};
        if (region_id) {
            where.regionId = parseInt(region_id);
        }
        if (service_id) {
            where.serviceId = parseInt(service_id);
        }

        const surgePrices = await prisma.surgePrice.findMany({
            where,
            include: {
                region: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                service: {
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
export const createSurgePrice = async (req, res) => {
    try {
        const { region_id, service_id, day, type, value, from_time, to_time } =
            req.body;

        const surgePrice = await prisma.surgePrice.create({
            data: {
                regionId: region_id ? parseInt(region_id) : null,
                serviceId: service_id ? parseInt(service_id) : null,
                day: day ? JSON.parse(day) : null,
                type,
                value: value ? parseFloat(value) : null,
                fromTime: from_time ? JSON.parse(from_time) : null,
                toTime: to_time ? JSON.parse(to_time) : null,
            },
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
        const { region_id, service_id, day, type, value, from_time, to_time } =
            req.body;

        const surgePrice = await prisma.surgePrice.update({
            where: { id: parseInt(id) },
            data: {
                regionId: region_id ? parseInt(region_id) : null,
                serviceId: service_id ? parseInt(service_id) : null,
                day: day ? JSON.parse(day) : null,
                type,
                value: value ? parseFloat(value) : null,
                fromTime: from_time ? JSON.parse(from_time) : null,
                toTime: to_time ? JSON.parse(to_time) : null,
            },
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



