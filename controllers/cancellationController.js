import prisma from "../utils/prisma.js";

// @desc    Get cancellation reason list
// @route   GET /api/cancellations/cancelReason-list
// @access  Private
export const getCancellationList = async (req, res) => {
    try {
        const { type } = req.query;
        const where = { status: 1 };

        if (type) {
            where.type = type;
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



