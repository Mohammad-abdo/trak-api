import prisma from "../utils/prisma.js";

// @desc    Get all category-zone mappings
// @route   GET /api/category-zones
// @access  Public
export const getCategoryZones = async (req, res) => {
    try {
        const { status, vehicle_category_id, geographic_zone_id } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }
        if (vehicle_category_id) {
            where.vehicleCategoryId = parseInt(vehicle_category_id);
        }
        if (geographic_zone_id) {
            where.geographicZoneId = parseInt(geographic_zone_id);
        }

        const mappings = await prisma.categoryZone.findMany({
            where,
            include: {
                vehicleCategory: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                    },
                },
                geographicZone: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: mappings,
        });
    } catch (error) {
        console.error("Get category zones error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Assign zone to category
// @route   POST /api/category-zones/assign
// @access  Private (Admin)
export const assignZoneToCategory = async (req, res) => {
    try {
        const { vehicle_category_id, geographic_zone_id, status } = req.body;

        if (!vehicle_category_id || !geographic_zone_id) {
            return res.status(400).json({
                success: false,
                message: "Vehicle category ID and geographic zone ID are required",
            });
        }

        // Check if mapping already exists
        const existing = await prisma.categoryZone.findFirst({
            where: {
                vehicleCategoryId: parseInt(vehicle_category_id),
                geographicZoneId: parseInt(geographic_zone_id),
            },
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "This mapping already exists",
            });
        }

        const mapping = await prisma.categoryZone.create({
            data: {
                vehicleCategoryId: parseInt(vehicle_category_id),
                geographicZoneId: parseInt(geographic_zone_id),
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: mapping,
            message: "Zone assigned to category successfully",
        });
    } catch (error) {
        console.error("Assign zone to category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Bulk assign zones to category
// @route   POST /api/category-zones/bulk-assign
// @access  Private (Admin)
export const bulkAssignZones = async (req, res) => {
    try {
        const { vehicle_category_id, zone_ids, status } = req.body;

        if (!vehicle_category_id || !zone_ids || !Array.isArray(zone_ids)) {
            return res.status(400).json({
                success: false,
                message: "Vehicle category ID and zone IDs array are required",
            });
        }

        const mappings = zone_ids.map(zoneId => ({
            vehicleCategoryId: parseInt(vehicle_category_id),
            geographicZoneId: parseInt(zoneId),
            status: status !== undefined ? parseInt(status) : 1,
        }));

        const result = await prisma.categoryZone.createMany({
            data: mappings,
            skipDuplicates: true,
        });

        res.status(201).json({
            success: true,
            data: result,
            message: `${result.count} zones assigned successfully`,
        });
    } catch (error) {
        console.error("Bulk assign zones error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Remove zone mapping
// @route   DELETE /api/category-zones/:id
// @access  Private (Admin)
export const removeCategoryZone = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.categoryZone.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Zone mapping removed successfully",
        });
    } catch (error) {
        console.error("Remove category zone error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
