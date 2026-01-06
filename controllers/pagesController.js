import prisma from "../utils/prisma.js";

// @desc    Get pages list
// @route   GET /api/pages
// @access  Public
export const getPagesList = async (req, res) => {
    try {
        const { status } = req.query;

        const where = {};
        if (status !== undefined) {
            where.status = parseInt(status);
        }

        const pages = await prisma.pages.findMany({
            where,
            orderBy: { title: "asc" },
        });

        res.json({
            success: true,
            data: pages,
        });
    } catch (error) {
        console.error("Get pages list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get page by slug
// @route   GET /api/pages/:slug
// @access  Public
export const getPageBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const page = await prisma.pages.findUnique({
            where: { slug },
        });

        if (!page) {
            return res.status(404).json({
                success: false,
                message: "Page not found",
            });
        }

        res.json({
            success: true,
            data: page,
        });
    } catch (error) {
        console.error("Get page by slug error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create page
// @route   POST /api/pages
// @access  Private (Admin)
export const createPage = async (req, res) => {
    try {
        const { title, description, slug, status = 1 } = req.body;

        // Generate slug from title if not provided
        const pageSlug =
            slug ||
            title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");

        const page = await prisma.pages.create({
            data: {
                title,
                description,
                slug: pageSlug,
                status,
            },
        });

        res.status(201).json({
            success: true,
            data: page,
            message: "Page created successfully",
        });
    } catch (error) {
        console.error("Create page error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update page
// @route   PUT /api/pages/:id
// @access  Private (Admin)
export const updatePage = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, slug, status } = req.body;

        const page = await prisma.pages.update({
            where: { id: parseInt(id) },
            data: {
                title,
                description,
                slug,
                status,
            },
        });

        res.json({
            success: true,
            data: page,
            message: "Page updated successfully",
        });
    } catch (error) {
        console.error("Update page error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete page
// @route   DELETE /api/pages/:id
// @access  Private (Admin)
export const deletePage = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.pages.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Page deleted successfully",
        });
    } catch (error) {
        console.error("Delete page error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



