import prisma from "../utils/prisma.js";

// @desc    Get screen list
// @route   GET /api/screens
// @access  Private (Admin)
export const getScreenList = async (req, res) => {
    try {
        const screens = await prisma.screen.findMany({
            include: {
                defaultKeywords: true,
            },
            orderBy: { screenId: "asc" },
        });

        res.json({
            success: true,
            data: screens,
        });
    } catch (error) {
        console.error("Get screen list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create screen
// @route   POST /api/screens
// @access  Private (Admin)
export const createScreen = async (req, res) => {
    try {
        const { screenId, screenName } = req.body;

        const screen = await prisma.screen.create({
            data: {
                screenId: parseInt(screenId),
                screenName,
            },
        });

        res.status(201).json({
            success: true,
            data: screen,
            message: "Screen created successfully",
        });
    } catch (error) {
        console.error("Create screen error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update screen
// @route   PUT /api/screens/:id
// @access  Private (Admin)
export const updateScreen = async (req, res) => {
    try {
        const { id } = req.params;
        const { screenName } = req.body;

        const screen = await prisma.screen.update({
            where: { id: parseInt(id) },
            data: {
                screenName,
            },
        });

        res.json({
            success: true,
            data: screen,
            message: "Screen updated successfully",
        });
    } catch (error) {
        console.error("Update screen error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete screen
// @route   DELETE /api/screens/:id
// @access  Private (Admin)
export const deleteScreen = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.screen.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Screen deleted successfully",
        });
    } catch (error) {
        console.error("Delete screen error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



