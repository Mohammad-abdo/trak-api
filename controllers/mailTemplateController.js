import prisma from "../utils/prisma.js";

// @desc    Get mail template list
// @route   GET /api/mail-templates
// @access  Private (Admin)
export const getMailTemplateList = async (req, res) => {
    try {
        const { type } = req.query;

        const where = {};
        if (type) {
            where.type = type;
        }

        const templates = await prisma.mailTemplate.findMany({
            where,
            orderBy: { type: "asc" },
        });

        res.json({
            success: true,
            data: templates,
        });
    } catch (error) {
        console.error("Get mail template list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get mail template by type
// @route   GET /api/mail-templates/:type
// @access  Private (Admin)
export const getMailTemplateByType = async (req, res) => {
    try {
        const { type } = req.params;

        const template = await prisma.mailTemplate.findFirst({
            where: { type },
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: "Mail template not found",
            });
        }

        res.json({
            success: true,
            data: template,
        });
    } catch (error) {
        console.error("Get mail template by type error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create or update mail template
// @route   POST /api/mail-templates
// @route   PUT /api/mail-templates/:id
// @access  Private (Admin)
export const saveMailTemplate = async (req, res) => {
    try {
        const { type, subject, description } = req.body;

        const template = await prisma.mailTemplate.upsert({
            where: { type },
            update: {
                subject,
                description,
            },
            create: {
                type,
                subject,
                description,
            },
        });

        res.json({
            success: true,
            data: template,
            message: "Mail template saved successfully",
        });
    } catch (error) {
        console.error("Save mail template error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update mail template
// @route   PUT /api/mail-templates/:id
// @access  Private (Admin)
export const updateMailTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, description } = req.body;

        const template = await prisma.mailTemplate.update({
            where: { id: parseInt(id) },
            data: {
                subject,
                description,
            },
        });

        res.json({
            success: true,
            data: template,
            message: "Mail template updated successfully",
        });
    } catch (error) {
        console.error("Update mail template error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



