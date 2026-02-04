import prisma from "../utils/prisma.js";

// @desc    Get all category features
// @route   GET /api/category-features
// @access  Public
export const getCategoryFeatures = async (req, res) => {
    try {
        const { status, vehicle_category_id } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }
        if (vehicle_category_id) {
            where.vehicleCategoryId = parseInt(vehicle_category_id);
        }

        const features = await prisma.categoryFeature.findMany({
            where,
            include: {
                vehicleCategory: {
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
            data: features,
        });
    } catch (error) {
        console.error("Get category features error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create category feature
// @route   POST /api/category-features
// @access  Private (Admin)
export const createCategoryFeature = async (req, res) => {
    try {
        const { vehicle_category_id, name, name_ar, icon, status } = req.body;

        if (!vehicle_category_id || !name) {
            return res.status(400).json({
                success: false,
                message: "Vehicle category ID and name are required",
            });
        }

        const feature = await prisma.categoryFeature.create({
            data: {
                vehicleCategoryId: parseInt(vehicle_category_id),
                name,
                nameAr: name_ar,
                icon,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: feature,
            message: "Category feature created successfully",
        });
    } catch (error) {
        console.error("Create category feature error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update category feature
// @route   PUT /api/category-features/:id
// @access  Private (Admin)
export const updateCategoryFeature = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, name_ar, icon, status } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (name_ar !== undefined) updateData.nameAr = name_ar;
        if (icon !== undefined) updateData.icon = icon;
        if (status !== undefined) updateData.status = parseInt(status);

        const feature = await prisma.categoryFeature.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: feature,
            message: "Category feature updated successfully",
        });
    } catch (error) {
        console.error("Update category feature error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete category feature
// @route   DELETE /api/category-features/:id
// @access  Private (Admin)
export const deleteCategoryFeature = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.categoryFeature.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Category feature deleted successfully",
        });
    } catch (error) {
        console.error("Delete category feature error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
