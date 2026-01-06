import prisma from "../utils/prisma.js";

// @desc    Get SOS list
// @route   GET /api/sos/sos-list
// @access  Private
export const getSosList = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {
            userId: req.user.id,
        };

        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const sosList = await prisma.sos.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: sosList,
        });
    } catch (error) {
        console.error("Get SOS list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save SOS
// @route   POST /api/sos/save-sos
// @access  Private
export const saveSos = async (req, res) => {
    try {
        const { name, contactNumber } = req.body;

        const sos = await prisma.sos.create({
            data: {
                userId: req.user.id,
                name,
                contactNumber,
                status: 1,
            },
        });

        res.json({
            success: true,
            message: "SOS contact saved successfully",
            data: sos,
        });
    } catch (error) {
        console.error("Save SOS error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update SOS
// @route   POST /api/sos/sos-update/:id
// @access  Private
export const updateSos = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contactNumber, status } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (contactNumber) updateData.contactNumber = contactNumber;
        if (status !== undefined) updateData.status = parseInt(status);

        const sos = await prisma.sos.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            message: "SOS contact updated successfully",
            data: sos,
        });
    } catch (error) {
        console.error("Update SOS error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "SOS contact not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete SOS
// @route   POST /api/sos/sos-delete/:id
// @access  Private
export const deleteSos = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.sos.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "SOS contact deleted successfully",
        });
    } catch (error) {
        console.error("Delete SOS error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "SOS contact not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Admin SOS notify
// @route   POST /api/sos/admin-sos-notify
// @access  Private
export const adminSosNotify = async (req, res) => {
    try {
        const { rideRequestId, latitude, longitude } = req.body;

        // TODO: Implement notification system
        // For now, just return success
        res.json({
            success: true,
            message: "Admin notified successfully",
        });
    } catch (error) {
        console.error("Admin SOS notify error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



