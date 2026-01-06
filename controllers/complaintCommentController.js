import prisma from "../utils/prisma.js";

// @desc    Get complaint comment list
// @route   GET /api/complaint-comments/complaintcomment-list
// @access  Private
export const getComplaintCommentList = async (req, res) => {
    try {
        const { complaintId } = req.query;

        if (!complaintId) {
            return res.status(400).json({
                success: false,
                message: "Complaint ID is required",
            });
        }

        const comments = await prisma.complaintComment.findMany({
            where: {
                complaintId: parseInt(complaintId),
            },
            orderBy: { createdAt: "asc" },
        });

        res.json({
            success: true,
            data: comments,
        });
    } catch (error) {
        console.error("Get complaint comment list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save complaint comment
// @route   POST /api/complaint-comments/save-complaintcomment
// @access  Private
export const saveComplaintComment = async (req, res) => {
    try {
        const { complaintId, comment } = req.body;

        const complaintComment = await prisma.complaintComment.create({
            data: {
                complaintId: parseInt(complaintId),
                comment,
            },
        });

        res.json({
            success: true,
            message: "Comment saved successfully",
            data: complaintComment,
        });
    } catch (error) {
        console.error("Save complaint comment error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update complaint comment
// @route   POST /api/complaint-comments/update-complaintcomment/:id
// @access  Private
export const updateComplaintComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment } = req.body;

        const complaintComment = await prisma.complaintComment.update({
            where: { id: parseInt(id) },
            data: { comment },
        });

        res.json({
            success: true,
            message: "Comment updated successfully",
            data: complaintComment,
        });
    } catch (error) {
        console.error("Update complaint comment error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Comment not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



