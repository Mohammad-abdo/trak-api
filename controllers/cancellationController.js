import prisma from "../utils/prisma.js";

// @desc    Get cancellation reason list
// @route   GET /api/cancellations/cancelReason-list
// @access  Private
export const getCancellationList = async (req, res) => {
    try {
        const { type, status } = req.query;
        const where = { status: 1 }; // default: active only

        if (type) {
            where.type = type;
        }
        if (status !== undefined && status !== "" && status !== "all") {
            where.status = parseInt(status);
        }

        const cancellations = await prisma.cancellation.findMany({
            where,
            orderBy: { name: "asc" },
        });

        res.json({
            success: true,
            data: cancellations,
        });
    } catch (error) {
        console.error("Get cancellation list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get all cancellations (admin - includes inactive)
// @route   GET /api/cancellations
// @access  Private
export const getAllCancellations = async (req, res) => {
    try {
        const { type } = req.query;
        const where = {};
        if (type) where.type = type;

        const cancellations = await prisma.cancellation.findMany({
            where,
            orderBy: { name: "asc" },
        });

        res.json({
            success: true,
            data: cancellations,
        });
    } catch (error) {
        console.error("Get all cancellations error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create cancellation reason
// @route   POST /api/cancellations
// @access  Private
export const createCancellation = async (req, res) => {
    try {
        const { name, name_ar, type, status } = req.body;

        const cancellation = await prisma.cancellation.create({
            data: {
                name: name || null,
                nameAr: name_ar || null,
                type: type || null,
                status: status !== undefined ? parseInt(status) : 1,
            },
        });

        res.status(201).json({
            success: true,
            data: cancellation,
            message: "Cancellation reason created successfully",
        });
    } catch (error) {
        console.error("Create cancellation error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update cancellation reason
// @route   PUT /api/cancellations/:id
// @access  Private
export const updateCancellation = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, name_ar, type, status } = req.body;

        const cancellation = await prisma.cancellation.update({
            where: { id: parseInt(id) },
            data: {
                ...(name !== undefined && { name }),
                ...(name_ar !== undefined && { nameAr: name_ar }),
                ...(type !== undefined && { type }),
                ...(status !== undefined && { status: parseInt(status) }),
            },
        });

        res.json({
            success: true,
            data: cancellation,
            message: "Cancellation reason updated successfully",
        });
    } catch (error) {
        console.error("Update cancellation error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete cancellation reason
// @route   DELETE /api/cancellations/:id
// @access  Private
export const deleteCancellation = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.cancellation.delete({
            where: { id: parseInt(id) },
        });
        res.json({
            success: true,
            message: "Cancellation reason deleted successfully",
        });
    } catch (error) {
        console.error("Delete cancellation error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



