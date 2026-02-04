import prisma from "../utils/prisma.js";

// @desc    Get all vehicle categories
// @route   GET /api/vehicle-categories
// @access  Public
export const getVehicleCategories = async (req, res) => {
    try {
        const { status, service_category_id } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }
        if (service_category_id) {
            where.serviceCategoryId = parseInt(service_category_id);
        }

        const categories = await prisma.vehicleCategory.findMany({
            where,
            include: {
                serviceCategory: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        slug: true,
                    },
                },
                features: {
                    where: { status: 1 },
                },
                pricingRules: {
                    where: { status: 1 },
                },
                zones: {
                    include: {
                        geographicZone: {
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
            data: categories,
        });
    } catch (error) {
        console.error("Get vehicle categories error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get vehicle category by ID
// @route   GET /api/vehicle-categories/:id
// @access  Public
export const getVehicleCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.vehicleCategory.findUnique({
            where: { id: parseInt(id) },
            include: {
                serviceCategory: true,
                features: true,
                pricingRules: true,
                zones: {
                    include: {
                        geographicZone: true,
                    },
                },
            },
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Vehicle category not found",
            });
        }

        res.json({
            success: true,
            data: category,
        });
    } catch (error) {
        console.error("Get vehicle category by ID error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get available vehicle categories by location
// @route   POST /api/vehicle-categories/available
// @access  Public
export const getAvailableCategories = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required",
            });
        }

        // Find zones that contain this location
        const zones = await prisma.geographicZone.findMany({
            where: { status: 1 },
        });

        // Filter zones by distance from center (simple radius check)
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        const nearbyZones = zones.filter(zone => {
            if (!zone.centerLat || !zone.centerLng || !zone.radius) return false;

            const distance = Math.sqrt(
                Math.pow(zone.centerLat - lat, 2) +
                Math.pow(zone.centerLng - lng, 2)
            ) * 111; // Rough conversion to km

            return distance <= zone.radius;
        });

        if (nearbyZones.length === 0) {
            return res.json({
                success: true,
                data: [],
                message: "No service zones available at this location",
            });
        }

        const zoneIds = nearbyZones.map(z => z.id);

        // Get categories available in these zones
        const categoryZones = await prisma.categoryZone.findMany({
            where: {
                geographicZoneId: { in: zoneIds },
                status: 1,
            },
            include: {
                vehicleCategory: {
                    include: {
                        serviceCategory: true,
                        features: true,
                        pricingRules: true,
                    },
                },
            },
        });

        const categories = categoryZones.map(cz => cz.vehicleCategory);
        const uniqueCategories = Array.from(
            new Map(categories.map(c => [c.id, c])).values()
        );

        res.json({
            success: true,
            data: uniqueCategories,
            zones: nearbyZones,
        });
    } catch (error) {
        console.error("Get available categories error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create vehicle category
// @route   POST /api/vehicle-categories
// @access  Private (Admin)
export const createVehicleCategory = async (req, res) => {
    try {
        const {
            service_category_id,
            name,
            name_ar,
            slug,
            description,
            description_ar,
            icon,
            image,
            capacity,
            max_load,
            status,
        } = req.body;

        const category = await prisma.vehicleCategory.create({
            data: {
                serviceCategoryId: parseInt(service_category_id),
                name,
                nameAr: name_ar,
                slug,
                description,
                descriptionAr: description_ar,
                icon,
                image,
                capacity: capacity ? parseInt(capacity) : null,
                maxLoad: max_load ? parseFloat(max_load) : null,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: category,
            message: "Vehicle category created successfully",
        });
    } catch (error) {
        console.error("Create vehicle category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update vehicle category
// @route   PUT /api/vehicle-categories/:id
// @access  Private (Admin)
export const updateVehicleCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            service_category_id,
            name,
            name_ar,
            slug,
            description,
            description_ar,
            icon,
            image,
            capacity,
            max_load,
            status,
        } = req.body;

        const updateData = {};
        if (service_category_id) updateData.serviceCategoryId = parseInt(service_category_id);
        if (name) updateData.name = name;
        if (name_ar !== undefined) updateData.nameAr = name_ar;
        if (slug) updateData.slug = slug;
        if (description !== undefined) updateData.description = description;
        if (description_ar !== undefined) updateData.descriptionAr = description_ar;
        if (icon !== undefined) updateData.icon = icon;
        if (image !== undefined) updateData.image = image;
        if (capacity !== undefined) updateData.capacity = capacity ? parseInt(capacity) : null;
        if (max_load !== undefined) updateData.maxLoad = max_load ? parseFloat(max_load) : null;
        if (status !== undefined) updateData.status = parseInt(status);

        const category = await prisma.vehicleCategory.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: category,
            message: "Vehicle category updated successfully",
        });
    } catch (error) {
        console.error("Update vehicle category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete vehicle category
// @route   DELETE /api/vehicle-categories/:id
// @access  Private (Admin)
export const deleteVehicleCategory = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.vehicleCategory.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Vehicle category deleted successfully",
        });
    } catch (error) {
        console.error("Delete vehicle category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
