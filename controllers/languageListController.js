import prisma from "../utils/prisma.js";

// @desc    Get language list
// @route   GET /api/language-lists
// @access  Private (Admin)
export const getLanguageList = async (req, res) => {
    try {
        const { status } = req.query;

        const where = {};
        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const languages = await prisma.languageList.findMany({
            where,
            include: {
                languageDefaultList: true,
                languageWithKeywords: true,
            },
            orderBy: { languageName: "asc" },
        });

        res.json({
            success: true,
            data: languages,
        });
    } catch (error) {
        console.error("Get language list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create language
// @route   POST /api/language-lists
// @access  Private (Admin)
export const createLanguage = async (req, res) => {
    try {
        const {
            language_id,
            language_name,
            language_code,
            country_code,
            language_flag,
            is_rtl,
            is_default,
            status,
        } = req.body;

        const language = await prisma.languageList.create({
            data: {
                languageId: language_id ? parseInt(language_id) : null,
                languageName: language_name,
                languageCode: language_code,
                countryCode: country_code,
                languageFlag: language_flag,
                isRtl: is_rtl || 0,
                isDefault: is_default || 0,
                status: status || 0,
            },
        });

        res.status(201).json({
            success: true,
            data: language,
            message: "Language created successfully",
        });
    } catch (error) {
        console.error("Create language error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update language
// @route   PUT /api/language-lists/:id
// @access  Private (Admin)
export const updateLanguage = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            language_name,
            language_code,
            country_code,
            language_flag,
            is_rtl,
            is_default,
            status,
        } = req.body;

        const language = await prisma.languageList.update({
            where: { id: parseInt(id) },
            data: {
                languageName: language_name,
                languageCode: language_code,
                countryCode: country_code,
                languageFlag: language_flag,
                isRtl: is_rtl,
                isDefault: is_default,
                status,
            },
        });

        res.json({
            success: true,
            data: language,
            message: "Language updated successfully",
        });
    } catch (error) {
        console.error("Update language error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete language
// @route   DELETE /api/language-lists/:id
// @access  Private (Admin)
export const deleteLanguage = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.languageList.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Language deleted successfully",
        });
    } catch (error) {
        console.error("Delete language error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



