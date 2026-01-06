import prisma from "../utils/prisma.js";
import { generateCSV } from "../utils/exportUtils.js";
import csv from "csv-parser";
import { Readable } from "stream";

// @desc    Get language with keyword list
// @route   GET /api/language-with-keywords
// @access  Private (Admin)
export const getLanguageWithKeywordList = async (req, res) => {
    try {
        const { language_id, keyword_id, screen_id } = req.query;

        const where = {};
        if (language_id) {
            where.languageId = parseInt(language_id);
        }
        if (keyword_id) {
            where.keywordId = parseInt(keyword_id);
        }
        if (screen_id) {
            where.screenId = parseInt(screen_id);
        }

        const keywords = await prisma.languageWithKeyword.findMany({
            where,
            include: {
                languageList: true,
                defaultKeyword: true,
                screen: true,
            },
            orderBy: { languageId: "asc" },
        });

        res.json({
            success: true,
            data: keywords,
        });
    } catch (error) {
        console.error("Get language with keyword list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create language with keyword
// @route   POST /api/language-with-keywords
// @access  Private (Admin)
export const createLanguageWithKeyword = async (req, res) => {
    try {
        const { language_id, keyword_id, screen_id, keyword_value } = req.body;

        const keyword = await prisma.languageWithKeyword.create({
            data: {
                languageId: parseInt(language_id),
                keywordId: keyword_id ? parseInt(keyword_id) : null,
                screenId: screen_id ? parseInt(screen_id) : null,
                keywordValue: keyword_value,
            },
        });

        res.status(201).json({
            success: true,
            data: keyword,
            message: "Language keyword created successfully",
        });
    } catch (error) {
        console.error("Create language with keyword error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update language with keyword
// @route   PUT /api/language-with-keywords/:id
// @access  Private (Admin)
export const updateLanguageWithKeyword = async (req, res) => {
    try {
        const { id } = req.params;
        const { keyword_value } = req.body;

        const keyword = await prisma.languageWithKeyword.update({
            where: { id: parseInt(id) },
            data: {
                keywordValue: keyword_value,
            },
        });

        res.json({
            success: true,
            data: keyword,
            message: "Language keyword updated successfully",
        });
    } catch (error) {
        console.error("Update language with keyword error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete language with keyword
// @route   DELETE /api/language-with-keywords/:id
// @access  Private (Admin)
export const deleteLanguageWithKeyword = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.languageWithKeyword.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Language keyword deleted successfully",
        });
    } catch (error) {
        console.error("Delete language with keyword error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Export language keywords to CSV
// @route   GET /api/language-with-keywords/export
// @access  Private (Admin)
export const exportLanguageKeywords = async (req, res) => {
    try {
        const { language_id } = req.query;

        const where = {};
        if (language_id) {
            where.languageId = parseInt(language_id);
        }

        const keywords = await prisma.languageWithKeyword.findMany({
            where,
            include: {
                languageList: {
                    select: {
                        name: true,
                    },
                },
                defaultKeyword: {
                    select: {
                        keyword: true,
                    },
                },
                screen: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { languageId: "asc" },
        });

        // Prepare data for CSV export
        const exportData = keywords.map((kw) => ({
            'Language': kw.languageList?.name || '',
            'Keyword': kw.defaultKeyword?.keyword || '',
            'Value': kw.keywordValue || '',
            'Screen': kw.screen?.name || '',
        }));

        const headers = [
            { key: 'Language', label: 'Language' },
            { key: 'Keyword', label: 'Keyword' },
            { key: 'Value', label: 'Value' },
            { key: 'Screen', label: 'Screen' },
        ];

        const csv = generateCSV(exportData, headers);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=language-keywords-${Date.now()}.csv`);
        res.send(csv);
    } catch (error) {
        console.error("Export language keywords error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Import language keywords from CSV
// @route   POST /api/language-with-keywords/import
// @access  Private (Admin)
export const importLanguageKeywords = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded",
            });
        }

        const fileBuffer = req.file.buffer;
        const keywordsToImport = [];

        const stream = Readable.from(fileBuffer.toString());
        await new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on("data", (row) => {
                    keywordsToImport.push(row);
                })
                .on("end", () => {
                    resolve();
                })
                .on("error", (error) => {
                    reject(error);
                });
        });

        // Get language list to map names to IDs
        const languages = await prisma.languageList.findMany();
        const languageMap = {};
        languages.forEach((lang) => {
            languageMap[lang.name.toLowerCase()] = lang.id;
        });

        // Get default keywords to map names to IDs
        const defaultKeywords = await prisma.defaultKeyword.findMany();
        const keywordMap = {};
        defaultKeywords.forEach((kw) => {
            keywordMap[kw.keyword.toLowerCase()] = kw.id;
        });

        // Get screens to map names to IDs
        const screens = await prisma.screen.findMany();
        const screenMap = {};
        screens.forEach((screen) => {
            screenMap[screen.name.toLowerCase()] = screen.id;
        });

        const newKeywords = [];
        const updatedKeywords = [];

        for (const row of keywordsToImport) {
            const languageName = (row.Language || row.language || '').toLowerCase();
            const keywordName = (row.Keyword || row.keyword || '').toLowerCase();
            const value = row.Value || row.value || row.keyword_value || '';
            const screenName = (row.Screen || row.screen || '').toLowerCase();

            const languageId = languageMap[languageName];
            const keywordId = keywordMap[keywordName];
            const screenId = screenName ? screenMap[screenName] : null;

            if (!languageId || !keywordId || !value) {
                continue; // Skip invalid rows
            }

            // Check if keyword already exists
            const existing = await prisma.languageWithKeyword.findFirst({
                where: {
                    languageId,
                    keywordId,
                    screenId: screenId || null,
                },
            });

            if (existing) {
                // Update existing
                await prisma.languageWithKeyword.update({
                    where: { id: existing.id },
                    data: {
                        keywordValue: value,
                    },
                });
                updatedKeywords.push(existing.id);
            } else {
                // Create new
                const newKeyword = await prisma.languageWithKeyword.create({
                    data: {
                        languageId,
                        keywordId,
                        screenId,
                        keywordValue: value,
                    },
                });
                newKeywords.push(newKeyword.id);
            }
        }

        res.json({
            success: true,
            message: `Language keywords imported successfully. ${newKeywords.length} new keywords added, ${updatedKeywords.length} keywords updated.`,
            data: { newKeywords, updatedKeywords },
        });
    } catch (error) {
        console.error("Import language keywords error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



