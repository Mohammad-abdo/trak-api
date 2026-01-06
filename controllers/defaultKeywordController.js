import prisma from "../utils/prisma.js";

// @desc    Get default keyword list
// @route   GET /api/default-keywords
// @access  Private (Admin)
export const getDefaultKeywordList = async (req, res) => {
    try {
        const { screen_id } = req.query;

        const where = {};
        if (screen_id) {
            where.screenId = parseInt(screen_id);
        }

        const keywords = await prisma.defaultKeyword.findMany({
            where,
            include: {
                screen: true,
            },
            orderBy: { keywordName: "asc" },
        });

        res.json({
            success: true,
            data: keywords,
        });
    } catch (error) {
        console.error("Get default keyword list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create default keyword
// @route   POST /api/default-keywords
// @access  Private (Admin)
export const createDefaultKeyword = async (req, res) => {
    try {
        const { screen_id, keyword_id, keyword_name, keyword_value } =
            req.body;

        const keyword = await prisma.defaultKeyword.create({
            data: {
                screenId: screen_id ? parseInt(screen_id) : null,
                keywordId: keyword_id ? parseInt(keyword_id) : null,
                keywordName: keyword_name,
                keywordValue: keyword_value,
            },
        });

        res.status(201).json({
            success: true,
            data: keyword,
            message: "Default keyword created successfully",
        });
    } catch (error) {
        console.error("Create default keyword error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update default keyword
// @route   PUT /api/default-keywords/:id
// @access  Private (Admin)
export const updateDefaultKeyword = async (req, res) => {
    try {
        const { id } = req.params;
        const { keyword_name, keyword_value } = req.body;

        const keyword = await prisma.defaultKeyword.update({
            where: { id: parseInt(id) },
            data: {
                keywordName: keyword_name,
                keywordValue: keyword_value,
            },
        });

        res.json({
            success: true,
            data: keyword,
            message: "Default keyword updated successfully",
        });
    } catch (error) {
        console.error("Update default keyword error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete default keyword
// @route   DELETE /api/default-keywords/:id
// @access  Private (Admin)
export const deleteDefaultKeyword = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.defaultKeyword.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Default keyword deleted successfully",
        });
    } catch (error) {
        console.error("Delete default keyword error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



