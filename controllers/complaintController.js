import prisma from "../utils/prisma.js";

// @desc    Save complaint
// @route   POST /api/complaints/save-complaint
// @access  Private
export const saveComplaint = async (req, res) => {
    try {
        const { driverId, riderId, complaintBy, subject, description, rideRequestId } = req.body;

        const complaint = await prisma.complaint.create({
            data: {
                driverId: driverId ? parseInt(driverId) : null,
                riderId: riderId ? parseInt(riderId) : req.user.id,
                complaintBy: complaintBy || req.user.userType,
                subject,
                description,
                rideRequestId: rideRequestId ? parseInt(rideRequestId) : null,
                status: "pending",
            },
        });

        res.json({
            success: true,
            message: "Complaint saved successfully",
            data: complaint,
        });
    } catch (error) {
        console.error("Save complaint error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get complaint list
// @route   GET /api/complaints
// @access  Private (Admin)
export const getComplaintList = async (req, res) => {
    try {
        const { status, complaint_by } = req.query;
        const where = {};

        if (status) {
            where.status = status;
        }
        if (complaint_by) {
            where.complaintBy = complaint_by;
        }

        const complaints = await prisma.complaint.findMany({
            where,
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                rideRequest: {
                    select: {
                        id: true,
                        startAddress: true,
                        endAddress: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: complaints,
        });
    } catch (error) {
        console.error("Get complaint list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get complaint detail
// @route   GET /api/complaints/:id
// @access  Private
export const getComplaintDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const complaint = await prisma.complaint.findUnique({
            where: { id: parseInt(id) },
            include: {
                rider: true,
                driver: true,
                rideRequest: true,
                complaintComments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                },
            },
        });

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found",
            });
        }

        res.json({
            success: true,
            data: complaint,
        });
    } catch (error) {
        console.error("Get complaint detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update complaint
// @route   PUT /api/complaints/:id
// @access  Private
export const updateComplaint = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, description, status } = req.body;

        const updateData = {};
        if (subject) updateData.subject = subject;
        if (description) updateData.description = description;
        if (status) updateData.status = status;

        const complaint = await prisma.complaint.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            message: "Complaint updated successfully",
            data: complaint,
        });
    } catch (error) {
        console.error("Update complaint error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Complaint not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete complaint
// @route   DELETE /api/complaints/:id
// @access  Private (Admin)
export const deleteComplaint = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.complaint.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Complaint deleted successfully",
        });
    } catch (error) {
        console.error("Delete complaint error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

