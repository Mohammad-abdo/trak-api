import prisma from "../utils/prisma.js";

// @desc    Get region list
// @route   GET /api/regions/region-list
// @access  Private
export const getRegionList = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const regions = await prisma.region.findMany({
            where,
            orderBy: { name: "asc" },
        });

        res.json({
            success: true,
            data: regions,
        });
    } catch (error) {
        console.error("Get region list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get region detail
// @route   GET /api/regions/:id
// @access  Private
export const getRegionDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const region = await prisma.region.findUnique({
            where: { id: parseInt(id) },
        });

        if (!region) {
            return res.status(404).json({
                success: false,
                message: "Region not found",
            });
        }

        res.json({
            success: true,
            data: region,
        });
    } catch (error) {
        console.error("Get region detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create region
// @route   POST /api/regions
// @access  Private (Admin)
export const createRegion = async (req, res) => {
    try {
        const { name, nameAr, distanceUnit, coordinates, timezone, status } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Region name is required",
            });
        }

        const region = await prisma.region.create({
            data: {
                name,
                nameAr: nameAr || null,
                distanceUnit: distanceUnit || "km",
                coordinates: coordinates || null,
                timezone: timezone || "UTC",
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: region,
            message: "Region created successfully",
        });
    } catch (error) {
        console.error("Create region error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update region
// @route   PUT /api/regions/:id
// @access  Private (Admin)
export const updateRegion = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, nameAr, distanceUnit, coordinates, timezone, status } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (nameAr !== undefined) updateData.nameAr = nameAr;
        if (distanceUnit) updateData.distanceUnit = distanceUnit;
        if (coordinates !== undefined) updateData.coordinates = coordinates;
        if (timezone) updateData.timezone = timezone;
        if (status !== undefined) updateData.status = parseInt(status);

        const region = await prisma.region.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: region,
            message: "Region updated successfully",
        });
    } catch (error) {
        console.error("Update region error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Region not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete region
// @route   DELETE /api/regions/:id
// @access  Private (Admin)
export const deleteRegion = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if region has associated services
        const servicesCount = await prisma.service.count({
            where: { regionId: parseInt(id) },
        });

        if (servicesCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete region. It has ${servicesCount} associated service(s). Please remove or reassign services first.`,
            });
        }

        // Check if region has associated surge prices
        const surgePricesCount = await prisma.surgePrice.count({
            where: { regionId: parseInt(id) },
        });

        if (surgePricesCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete region. It has ${surgePricesCount} associated surge price(s). Please remove surge prices first.`,
            });
        }

        await prisma.region.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Region deleted successfully",
        });
    } catch (error) {
        console.error("Delete region error:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                message: "Region not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



