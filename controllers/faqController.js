import prisma from "../utils/prisma.js";

// @desc    Get FAQ list
// @route   GET /api/faqs/faq-list
// @access  Private
export const getFaqList = async (req, res) => {
    try {
        const { question, app } = req.query;
        const where = { deletedAt: null };

        // Filter by user type
        if (req.user.userType === "rider") {
            where.type = "rider";
        } else if (req.user.userType === "driver") {
            where.type = "driver";
        }

        if (question) {
            where.question = {
                contains: question,
            };
        }

        if (app) {
            where.type = {
                contains: app,
            };
        }

        const faqs = await prisma.faq.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: faqs,
        });
    } catch (error) {
        console.error("Get FAQ list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create FAQ
// @route   POST /api/faqs
// @access  Private (Admin)
export const createFaq = async (req, res) => {
    try {
        const { question, answer, type = "rider", status = 1 } = req.body;

        const faq = await prisma.faq.create({
            data: {
                question,
                answer,
                type,
                status: parseInt(status),
            },
        });

        res.status(201).json({
            success: true,
            data: faq,
            message: "FAQ created successfully",
        });
    } catch (error) {
        console.error("Create FAQ error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update FAQ
// @route   PUT /api/faqs/:id
// @access  Private (Admin)
export const updateFaq = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, answer, type, status } = req.body;

        const updateData = {};
        if (question !== undefined) updateData.question = question;
        if (answer !== undefined) updateData.answer = answer;
        if (type !== undefined) updateData.type = type;
        if (status !== undefined) updateData.status = parseInt(status);

        const faq = await prisma.faq.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: faq,
            message: "FAQ updated successfully",
        });
    } catch (error) {
        console.error("Update FAQ error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete FAQ
// @route   DELETE /api/faqs/:id
// @access  Private (Admin)
export const deleteFaq = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.faq.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() },
        });

        res.json({
            success: true,
            message: "FAQ deleted successfully",
        });
    } catch (error) {
        console.error("Delete FAQ error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "FAQ not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


