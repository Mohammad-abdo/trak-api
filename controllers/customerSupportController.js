import prisma from "../utils/prisma.js";

// @desc    Get customer support list
// @route   GET /api/customer-support
// @access  Private
export const getCustomerSupportList = async (req, res) => {
    try {
        const { status, supportType } = req.query;
        const where = {};

        // If user is not admin, only show their own support requests
        if (req.user.userType !== 'admin') {
            where.userId = req.user.id;
        }

        if (status) {
            where.status = status;
        }

        if (supportType) {
            where.supportType = supportType;
        }

        const customerSupports = await prisma.customerSupport.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        userType: true,
                    },
                },
                chatHistories: {
                    include: {
                        support: true,
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: customerSupports,
        });
    } catch (error) {
        console.error("Get customer support list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get customer support detail
// @route   GET /api/customer-support/:id
// @access  Private
export const getCustomerSupportDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const customerSupport = await prisma.customerSupport.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        userType: true,
                    },
                },
                chatHistories: {
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });

        // Check if user has access
        if (req.user.userType !== 'admin' && customerSupport.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        res.json({
            success: true,
            data: customerSupport,
        });
    } catch (error) {
        console.error("Get customer support detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create customer support
// @route   POST /api/customer-support
// @access  Private
export const createCustomerSupport = async (req, res) => {
    try {
        const { message, supportType } = req.body;

        const customerSupport = await prisma.customerSupport.create({
            data: {
                message,
                supportType,
                userId: req.user.id,
                status: 'pending',
            },
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

        // Create initial chat history
        await prisma.supportChathistory.create({
            data: {
                supportId: customerSupport.id,
                message,
                senderType: req.user.userType,
            },
        });

        res.status(201).json({
            success: true,
            data: customerSupport,
            message: "Customer support created successfully",
        });
    } catch (error) {
        console.error("Create customer support error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update customer support status
// @route   PUT /api/customer-support/:id/status
// @access  Private (Admin)
export const updateCustomerSupportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolutionDetail } = req.body;

        const validStatuses = ['pending', 'inreview', 'resolved'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Must be one of: pending, inreview, resolved",
            });
        }

        const customerSupport = await prisma.customerSupport.update({
            where: { id: parseInt(id) },
            data: {
                status,
                resolutionDetail,
            },
        });

        res.json({
            success: true,
            data: customerSupport,
            message: "Customer support status updated successfully",
        });
    } catch (error) {
        console.error("Update customer support status error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete customer support
// @route   DELETE /api/customer-support/:id
// @access  Private (Admin)
export const deleteCustomerSupport = async (req, res) => {
    try {
        const { id } = req.params;

        // Delete chat histories first (cascade)
        await prisma.supportChathistory.deleteMany({
            where: { supportId: parseInt(id) },
        });

        await prisma.customerSupport.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Customer support deleted successfully",
        });
    } catch (error) {
        console.error("Delete customer support error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Customer support not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


