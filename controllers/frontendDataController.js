import prisma from "../utils/prisma.js";

// @desc    Get frontend data list
// @route   GET /api/frontend-data
// @access  Public
export const getFrontendDataList = async (req, res) => {
    try {
        const { type } = req.query;

        const where = {};
        if (type) {
            where.type = type;
        }

        const frontendData = await prisma.frontendData.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: frontendData,
        });
    } catch (error) {
        console.error("Get frontend data list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get frontend data by type
// @route   GET /api/frontend-data/:type
// @access  Public
export const getFrontendDataByType = async (req, res) => {
    try {
        const { type } = req.params;

        const frontendData = await prisma.frontendData.findMany({
            where: { type },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: frontendData,
        });
    } catch (error) {
        console.error("Get frontend data by type error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create frontend data
// @route   POST /api/frontend-data
// @access  Private (Admin)
export const createFrontendData = async (req, res) => {
    try {
        const { title, subtitle, type, description } = req.body;

        const frontendData = await prisma.frontendData.create({
            data: {
                title,
                subtitle,
                type,
                description,
            },
        });

        res.status(201).json({
            success: true,
            data: frontendData,
            message: "Frontend data created successfully",
        });
    } catch (error) {
        console.error("Create frontend data error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update frontend data
// @route   PUT /api/frontend-data/:id
// @access  Private (Admin)
export const updateFrontendData = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subtitle, type, description } = req.body;

        const frontendData = await prisma.frontendData.update({
            where: { id: parseInt(id) },
            data: {
                title,
                subtitle,
                type,
                description,
            },
        });

        res.json({
            success: true,
            data: frontendData,
            message: "Frontend data updated successfully",
        });
    } catch (error) {
        console.error("Update frontend data error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete frontend data
// @route   DELETE /api/frontend-data/:id
// @access  Private (Admin)
export const deleteFrontendData = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.frontendData.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Frontend data deleted successfully",
        });
    } catch (error) {
        console.error("Delete frontend data error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



