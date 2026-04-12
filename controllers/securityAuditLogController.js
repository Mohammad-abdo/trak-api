import prisma from "../utils/prisma.js";

/**
 * @route GET /api/admin/security-logs
 * @access Admin
 * Query: category, user_id, page, per_page, from_date, to_date
 */
export const getSecurityAuditLogs = async (req, res) => {
    try {
        const {
            category,
            user_id,
            page = 1,
            per_page = 50,
            from_date,
            to_date,
        } = req.query;

        const where = {};
        if (category && typeof category === "string") {
            where.category = category;
        }
        if (user_id) {
            where.userId = parseInt(user_id, 10);
        }
        if (from_date || to_date) {
            where.createdAt = {};
            if (from_date) where.createdAt.gte = new Date(from_date);
            if (to_date) where.createdAt.lte = new Date(to_date);
        }

        const take = Math.min(parseInt(per_page, 10) || 50, 200);
        const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;

        const [rows, total] = await Promise.all([
            prisma.securityAuditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.securityAuditLog.count({ where }),
        ]);

        return res.json({
            success: true,
            data: rows,
            pagination: {
                total,
                page: parseInt(page, 10) || 1,
                per_page: take,
                total_pages: Math.ceil(total / take) || 0,
            },
        });
    } catch (error) {
        console.error("getSecurityAuditLogs:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to list security logs",
        });
    }
};
