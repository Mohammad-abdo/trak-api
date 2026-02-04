import prisma from "../utils/prisma.js";

// @desc    Get all service categories
// @route   GET /api/service-categories
// @access  Public
export const getServiceCategories = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const categories = await prisma.serviceCategory.findMany({
            where,
            include: {
                vehicleCategories: {
                    where: { status: 1 },
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        slug: true,
                        icon: true,
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
        console.error("Get service categories error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get service category by ID
// @route   GET /api/service-categories/:id
// @access  Public
export const getServiceCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.serviceCategory.findUnique({
            where: { id: parseInt(id) },
            include: {
                vehicleCategories: {
                    include: {
                        features: true,
                        pricingRules: true,
                        zones: {
                            include: {
                                geographicZone: true,
                            },
                        },
                    },
                },
            },
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Service category not found",
            });
        }

        res.json({
            success: true,
            data: category,
        });
    } catch (error) {
        console.error("Get service category by ID error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create service category
// @route   POST /api/service-categories
// @access  Private (Admin)
export const createServiceCategory = async (req, res) => {
    try {
        const { name, name_ar, slug, description, description_ar, icon, status } = req.body;

        const category = await prisma.serviceCategory.create({
            data: {
                name,
                nameAr: name_ar,
                slug,
                description,
                descriptionAr: description_ar,
                icon,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: category,
            message: "Service category created successfully",
        });
    } catch (error) {
        console.error("Create service category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update service category
// @route   PUT /api/service-categories/:id
// @access  Private (Admin)
export const updateServiceCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, name_ar, slug, description, description_ar, icon, status } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (name_ar !== undefined) updateData.nameAr = name_ar;
        if (slug) updateData.slug = slug;
        if (description !== undefined) updateData.description = description;
        if (description_ar !== undefined) updateData.descriptionAr = description_ar;
        if (icon !== undefined) updateData.icon = icon;
        if (status !== undefined) updateData.status = parseInt(status);

        const category = await prisma.serviceCategory.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: category,
            message: "Service category updated successfully",
        });
    } catch (error) {
        console.error("Update service category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete service category
// @route   DELETE /api/service-categories/:id
// @access  Private (Admin)
export const deleteServiceCategory = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.serviceCategory.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Service category deleted successfully",
        });
    } catch (error) {
        console.error("Delete service category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
