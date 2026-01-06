import prisma from "../utils/prisma.js";

// @desc    Get chat history for a support ticket
// @route   GET /api/support-chat-history/:supportId
// @access  Private
export const getChatHistory = async (req, res) => {
    try {
        const { supportId } = req.params;

        // Verify user has access to this support ticket
        const customerSupport = await prisma.customerSupport.findUnique({
            where: { id: parseInt(supportId) },
        });

        if (!customerSupport) {
            return res.status(404).json({
                success: false,
                message: "Customer support not found",
            });
        }

        if (req.user.userType !== 'admin' && customerSupport.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const chatHistories = await prisma.supportChathistory.findMany({
            where: { supportId: parseInt(supportId) },
            orderBy: { createdAt: 'asc' },
        });

        res.json({
            success: true,
            data: chatHistories,
        });
    } catch (error) {
        console.error("Get chat history error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create chat message
// @route   POST /api/support-chat-history
// @access  Private
export const createChatMessage = async (req, res) => {
    try {
        const { supportId, message } = req.body;

        // Verify user has access to this support ticket
        const customerSupport = await prisma.customerSupport.findUnique({
            where: { id: parseInt(supportId) },
        });

        if (!customerSupport) {
            return res.status(404).json({
                success: false,
                message: "Customer support not found",
            });
        }

        if (req.user.userType !== 'admin' && customerSupport.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const chatHistory = await prisma.supportChathistory.create({
            data: {
                supportId: parseInt(supportId),
                message,
                senderType: req.user.userType,
            },
        });

        res.status(201).json({
            success: true,
            data: chatHistory,
            message: "Message sent successfully",
        });
    } catch (error) {
        console.error("Create chat message error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update chat message
// @route   PUT /api/support-chat-history/:id
// @access  Private
export const updateChatMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        const chatHistory = await prisma.supportChathistory.findUnique({
            where: { id: parseInt(id) },
            include: {
                support: true,
            },
        });

        if (!chatHistory) {
            return res.status(404).json({
                success: false,
                message: "Chat message not found",
            });
        }

        // Verify user has access
        if (req.user.userType !== 'admin' && chatHistory.support.userId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Access denied",
            });
        }

        const updatedChatHistory = await prisma.supportChathistory.update({
            where: { id: parseInt(id) },
            data: { message },
        });

        res.json({
            success: true,
            data: updatedChatHistory,
            message: "Message updated successfully",
        });
    } catch (error) {
        console.error("Update chat message error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete chat message
// @route   DELETE /api/support-chat-history/:id
// @access  Private (Admin)
export const deleteChatMessage = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.supportChathistory.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Chat message deleted successfully",
        });
    } catch (error) {
        console.error("Delete chat message error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Chat message not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


