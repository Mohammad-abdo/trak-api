import prisma from "../utils/prisma.js";

// @desc    Get all geographic zones
// @route   GET /api/geographic-zones
// @access  Public
export const getGeographicZones = async (req, res) => {
    try {
        const { status, region_id } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }
        if (region_id) {
            where.regionId = parseInt(region_id);
        }

        const zones = await prisma.geographicZone.findMany({
            where,
            include: {
                region: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                    },
                },
                categoryZones: {
                    include: {
                        vehicleCategory: {
                            select: {
                                id: true,
                                name: true,
                                nameAr: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: zones,
        });
    } catch (error) {
        console.error("Get geographic zones error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get geographic zone by ID
// @route   GET /api/geographic-zones/:id
// @access  Public
export const getGeographicZoneById = async (req, res) => {
    try {
        const { id } = req.params;

        const zone = await prisma.geographicZone.findUnique({
            where: { id: parseInt(id) },
            include: {
                region: true,
                categoryZones: {
                    include: {
                        vehicleCategory: {
                            include: {
                                serviceCategory: true,
                                features: true,
                                pricingRules: true,
                            },
                        },
                    },
                },
            },
        });

        if (!zone) {
            return res.status(404).json({
                success: false,
                message: "Geographic zone not found",
            });
        }

        res.json({
            success: true,
            data: zone,
        });
    } catch (error) {
        console.error("Get geographic zone by ID error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Find zone by location
// @route   POST /api/geographic-zones/find-by-location
// @access  Public
export const findZoneByLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required",
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        const zones = await prisma.geographicZone.findMany({
            where: { status: 1 },
            include: {
                region: true,
                categoryZones: {
                    include: {
                        vehicleCategory: true,
                    },
                },
            },
        });

        // Find zones containing this point (simple radius check)
        const matchingZones = zones.filter(zone => {
            if (!zone.centerLat || !zone.centerLng || !zone.radius) return false;

            const distance = Math.sqrt(
                Math.pow(zone.centerLat - lat, 2) +
                Math.pow(zone.centerLng - lng, 2)
            ) * 111; // Rough conversion to km

            return distance <= zone.radius;
        });

        if (matchingZones.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: "No zone found at this location",
            });
        }

        res.json({
            success: true,
            data: matchingZones,
        });
    } catch (error) {
        console.error("Find zone by location error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create geographic zone
// @route   POST /api/geographic-zones
// @access  Private (Admin)
export const createGeographicZone = async (req, res) => {
    try {
        const {
            name,
            name_ar,
            region_id,
            center_lat,
            center_lng,
            radius,
            coordinates,
            status,
        } = req.body;

        const zone = await prisma.geographicZone.create({
            data: {
                name,
                nameAr: name_ar,
                regionId: region_id ? parseInt(region_id) : null,
                centerLat: center_lat ? parseFloat(center_lat) : null,
                centerLng: center_lng ? parseFloat(center_lng) : null,
                radius: radius ? parseFloat(radius) : null,
                coordinates: coordinates || null,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: zone,
            message: "Geographic zone created successfully",
        });
    } catch (error) {
        console.error("Create geographic zone error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update geographic zone
// @route   PUT /api/geographic-zones/:id
// @access  Private (Admin)
export const updateGeographicZone = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            name_ar,
            region_id,
            center_lat,
            center_lng,
            radius,
            coordinates,
            status,
        } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (name_ar !== undefined) updateData.nameAr = name_ar;
        if (region_id !== undefined) updateData.regionId = region_id ? parseInt(region_id) : null;
        if (center_lat !== undefined) updateData.centerLat = center_lat ? parseFloat(center_lat) : null;
        if (center_lng !== undefined) updateData.centerLng = center_lng ? parseFloat(center_lng) : null;
        if (radius !== undefined) updateData.radius = radius ? parseFloat(radius) : null;
        if (coordinates !== undefined) updateData.coordinates = coordinates;
        if (status !== undefined) updateData.status = parseInt(status);

        const zone = await prisma.geographicZone.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: zone,
            message: "Geographic zone updated successfully",
        });
    } catch (error) {
        console.error("Update geographic zone error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete geographic zone
// @route   DELETE /api/geographic-zones/:id
// @access  Private (Admin)
export const deleteGeographicZone = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.geographicZone.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Geographic zone deleted successfully",
        });
    } catch (error) {
        console.error("Delete geographic zone error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
