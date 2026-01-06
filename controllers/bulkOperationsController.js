import prisma from "../utils/prisma.js";

/**
 * Bulk delete users
 * @route   POST /api/bulk-operations/users/delete
 * @access  Private (Admin)
 */
export const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of user IDs",
            });
        }

        const deleted = await prisma.user.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) },
            },
        });

        res.json({
            success: true,
            message: `Successfully deleted ${deleted.count} user(s)`,
            data: { deletedCount: deleted.count },
        });
    } catch (error) {
        console.error("Bulk delete users error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Bulk delete ride requests
 * @route   POST /api/bulk-operations/ride-requests/delete
 * @access  Private (Admin)
 */
export const bulkDeleteRideRequests = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of ride request IDs",
            });
        }

        const deleted = await prisma.rideRequest.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) },
            },
        });

        res.json({
            success: true,
            message: `Successfully deleted ${deleted.count} ride request(s)`,
            data: { deletedCount: deleted.count },
        });
    } catch (error) {
        console.error("Bulk delete ride requests error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Bulk update user status
 * @route   POST /api/bulk-operations/users/update-status
 * @access  Private (Admin)
 */
export const bulkUpdateUserStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of user IDs",
            });
        }

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Please provide a status",
            });
        }

        const updated = await prisma.user.updateMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) },
            },
            data: { status },
        });

        res.json({
            success: true,
            message: `Successfully updated ${updated.count} user(s)`,
            data: { updatedCount: updated.count },
        });
    } catch (error) {
        console.error("Bulk update user status error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Bulk delete drivers
 * @route   POST /api/bulk-operations/drivers/delete
 * @access  Private (Admin)
 */
export const bulkDeleteDrivers = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of driver IDs",
            });
        }

        const deleted = await prisma.user.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) },
                userType: "driver",
            },
        });

        res.json({
            success: true,
            message: `Successfully deleted ${deleted.count} driver(s)`,
            data: { deletedCount: deleted.count },
        });
    } catch (error) {
        console.error("Bulk delete drivers error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Bulk delete riders
 * @route   POST /api/bulk-operations/riders/delete
 * @access  Private (Admin)
 */
export const bulkDeleteRiders = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of rider IDs",
            });
        }

        const deleted = await prisma.user.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id)) },
                userType: "rider",
            },
        });

        res.json({
            success: true,
            message: `Successfully deleted ${deleted.count} rider(s)`,
            data: { deletedCount: deleted.count },
        });
    } catch (error) {
        console.error("Bulk delete riders error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

