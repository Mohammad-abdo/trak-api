import prisma from "../utils/prisma.js";

// @desc    Get driver document list
// @route   GET /api/driver-documents/driver-document-list
// @access  Private
export const getDriverDocumentList = async (req, res) => {
    try {
        const { driverId } = req.query;
        const where = {};

        if (req.user.userType === "driver") {
            where.driverId = req.user.id;
        } else if (driverId) {
            where.driverId = parseInt(driverId);
        }

        const documents = await prisma.driverDocument.findMany({
            where,
            include: {
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                document: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        isRequired: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: documents,
        });
    } catch (error) {
        console.error("Get driver document list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save driver document
// @route   POST /api/driver-documents/driver-document-save
// @access  Private
export const saveDriverDocument = async (req, res) => {
    try {
        const { documentId, expireDate } = req.body;
        const driverId = req.user.userType === "driver" ? req.user.id : req.body.driverId;

        const document = await prisma.driverDocument.create({
            data: {
                driverId,
                documentId: parseInt(documentId),
                expireDate: expireDate ? new Date(expireDate) : null,
                isVerified: false,
            },
            include: {
                document: true,
            },
        });

        res.json({
            success: true,
            message: "Driver document saved successfully",
            data: document,
        });
    } catch (error) {
        console.error("Save driver document error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update driver document
// @route   POST /api/driver-documents/driver-document-update/:id
// @access  Private
export const updateDriverDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { documentId, expireDate, isVerified } = req.body;

        const updateData = {};
        if (documentId) updateData.documentId = parseInt(documentId);
        if (expireDate) updateData.expireDate = new Date(expireDate);
        if (isVerified !== undefined) updateData.isVerified = isVerified;

        const document = await prisma.driverDocument.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                document: true,
            },
        });

        res.json({
            success: true,
            message: "Driver document updated successfully",
            data: document,
        });
    } catch (error) {
        console.error("Update driver document error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Driver document not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete driver document
// @route   POST /api/driver-documents/driver-document-delete/:id
// @access  Private
export const deleteDriverDocument = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.driverDocument.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Driver document deleted successfully",
        });
    } catch (error) {
        console.error("Delete driver document error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Driver document not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



