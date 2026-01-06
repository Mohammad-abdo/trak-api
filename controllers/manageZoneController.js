import prisma from "../utils/prisma.js";

// @desc    Get manage zone list
// @route   GET /api/manage-zones/managezone-list
// @access  Private
export const getManageZoneList = async (req, res) => {
    try {
        const { name } = req.query;
        const where = {};

        if (name) {
            where.name = {
                contains: name,
            };
        }

        const zones = await prisma.manageZone.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: zones,
        });
    } catch (error) {
        console.error("Get manage zone list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save manage zone
// @route   POST /api/manage-zones/managezone-save
// @access  Private
export const saveManageZone = async (req, res) => {
    try {
        const { name, latitude, longitude, description, status = 1 } = req.body;

        if (!name || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Name, latitude, and longitude are required",
            });
        }

        const zone = await prisma.manageZone.create({
            data: {
                name,
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                description: description || null,
                status: status || 1,
            },
        });

        res.json({
            success: true,
            message: "Zone saved successfully",
            data: zone,
        });
    } catch (error) {
        console.error("Save manage zone error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update manage zone
// @route   PUT /api/manage-zones/:id
// @access  Private
export const updateManageZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, latitude, longitude, description, status } = req.body;

        if (!name || !latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Name, latitude, and longitude are required",
            });
        }

        const zone = await prisma.manageZone.update({
            where: { id: parseInt(id) },
            data: {
                name,
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                description: description || null,
                status: status !== undefined ? status : undefined,
            },
        });

        res.json({
            success: true,
            message: "Zone updated successfully",
            data: zone,
        });
    } catch (error) {
        console.error("Update manage zone error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Zone not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete manage zone
// @route   POST /api/manage-zones/managezone-delete/:id
// @access  Private
export const deleteManageZone = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.manageZone.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Zone deleted successfully",
        });
    } catch (error) {
        console.error("Delete manage zone error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Zone not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get zone prices list
// @route   GET /api/manage-zones/zone-prices
// @access  Private
export const getZonePrices = async (req, res) => {
    try {
        const zonePrices = await prisma.zonePrice.findMany({
            include: {
                pickupZone: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                dropoffZone: {
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
            data: zonePrices,
        });
    } catch (error) {
        console.error("Get zone prices error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



