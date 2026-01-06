import prisma from "../utils/prisma.js";

// @desc    Get document list
// @route   GET /api/documents/document-list
// @access  Public
export const getDocumentList = async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};

        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const documents = await prisma.document.findMany({
            where,
            orderBy: { name: "asc" },
        });

        res.json({
            success: true,
            data: documents,
        });
    } catch (error) {
        console.error("Get document list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get document detail
// @route   GET /api/documents/:id
// @access  Private (Admin)
export const getDocumentDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const document = await prisma.document.findUnique({
            where: { id: parseInt(id) },
        });

        if (!document) {
            return res.status(404).json({
                success: false,
                message: "Document not found",
            });
        }

        res.json({
            success: true,
            data: document,
        });
    } catch (error) {
        console.error("Get document detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create document
// @route   POST /api/documents
// @access  Private (Admin)
export const createDocument = async (req, res) => {
    try {
        const { name, type, status, is_required, has_expiry_date } = req.body;

        const document = await prisma.document.create({
            data: {
                name,
                type,
                status: status !== undefined ? parseInt(status) : 1,
                isRequired: is_required ? parseInt(is_required) : 0,
                hasExpiryDate: has_expiry_date ? parseInt(has_expiry_date) : 0,
            },
        });

        res.status(201).json({
            success: true,
            data: document,
            message: "Document created successfully",
        });
    } catch (error) {
        console.error("Create document error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update document
// @route   PUT /api/documents/:id
// @access  Private (Admin)
export const updateDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, status, is_required, has_expiry_date } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (type) updateData.type = type;
        if (status !== undefined) updateData.status = parseInt(status);
        if (is_required !== undefined) updateData.isRequired = parseInt(is_required);
        if (has_expiry_date !== undefined) updateData.hasExpiryDate = parseInt(has_expiry_date);

        const document = await prisma.document.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: document,
            message: "Document updated successfully",
        });
    } catch (error) {
        console.error("Update document error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Private (Admin)
export const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.document.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Document deleted successfully",
        });
    } catch (error) {
        console.error("Delete document error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

