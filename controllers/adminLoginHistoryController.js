import prisma from "../utils/prisma.js";

// @desc    Get admin login history list
// @route   GET /api/admin-login-history
// @access  Private (Admin)
export const getAdminLoginHistoryList = async (req, res) => {
    try {
        const { user_id, per_page = 50, page = 1 } = req.query;

        const where = {};
        if (user_id) {
            where.userId = parseInt(user_id);
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        const [histories, total] = await Promise.all([
            prisma.adminLoginHistory.findMany({
                where,
                skip,
                take: parseInt(per_page),
                orderBy: { createdAt: "desc" },
            }),
            prisma.adminLoginHistory.count({ where }),
        ]);

        res.json({
            success: true,
            data: histories,
            pagination: {
                total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                total_pages: Math.ceil(total / parseInt(per_page)),
            },
        });
    } catch (error) {
        console.error("Get admin login history list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get admin login history detail
// @route   GET /api/admin-login-history/:id
// @access  Private (Admin)
export const getAdminLoginHistoryDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const history = await prisma.adminLoginHistory.findUnique({
            where: { id: parseInt(id) },
        });

        if (!history) {
            return res.status(404).json({
                success: false,
                message: "History not found",
            });
        }

        res.json({
            success: true,
            data: history,
        });
    } catch (error) {
        console.error("Get admin login history detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



