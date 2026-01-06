import prisma from "../utils/prisma.js";

// @desc    Get admin login device list
// @route   GET /api/admin-login-devices
// @access  Private (Admin)
export const getAdminLoginDeviceList = async (req, res) => {
    try {
        const { user_id, is_active } = req.query;

        const where = {};
        if (user_id) {
            where.userId = parseInt(user_id);
        }
        if (is_active !== undefined) {
            where.isActive = is_active === "true";
        }

        const devices = await prisma.adminLoginDevice.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy: { loginAt: "desc" },
        });

        res.json({
            success: true,
            data: devices,
        });
    } catch (error) {
        console.error("Get admin login device list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get admin login device detail
// @route   GET /api/admin-login-devices/:id
// @access  Private (Admin)
export const getAdminLoginDeviceDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await prisma.adminLoginDevice.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!device) {
            return res.status(404).json({
                success: false,
                message: "Device not found",
            });
        }

        res.json({
            success: true,
            data: device,
        });
    } catch (error) {
        console.error("Get admin login device detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Logout device
// @route   POST /api/admin-login-devices/:id/logout
// @access  Private (Admin)
export const logoutDevice = async (req, res) => {
    try {
        const { id } = req.params;

        const device = await prisma.adminLoginDevice.update({
            where: { id: parseInt(id) },
            data: {
                isActive: false,
                logoutAt: new Date(),
            },
        });

        res.json({
            success: true,
            data: device,
            message: "Device logged out successfully",
        });
    } catch (error) {
        console.error("Logout device error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete admin login device
// @route   DELETE /api/admin-login-devices/:id
// @access  Private (Admin)
export const deleteAdminLoginDevice = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.adminLoginDevice.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Device deleted successfully",
        });
    } catch (error) {
        console.error("Delete admin login device error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



