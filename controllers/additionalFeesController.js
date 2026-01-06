import prisma from "../utils/prisma.js";

// @desc    Get additional fees list
// @route   GET /api/additional-fees/additional-fees-list
// @access  Private
export const getAdditionalFeesList = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const additionalFees = await prisma.additionalFees.findMany({
            where,
            orderBy: { title: "asc" },
        });

        res.json({
            success: true,
            data: additionalFees,
        });
    } catch (error) {
        console.error("Get additional fees list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

