import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";

// @desc    Get sub-admin list
// @route   GET /api/sub-admin
// @access  Private (Admin)
export const getSubAdminList = async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = {
            userType: {
                notIn: ["admin", "rider", "driver"],
            },
        };

        if (status) {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { contactNumber: { contains: search, mode: "insensitive" } },
            ];
        }

        const subAdmins = await prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
                countryCode: true,
                userType: true,
                status: true,
                lastActivedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: subAdmins,
        });
    } catch (error) {
        console.error("Get sub-admin list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create sub-admin
// @route   POST /api/sub-admin
// @access  Private (Admin)
export const createSubAdmin = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            countryCode,
            userType,
        } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: email?.toLowerCase() },
                    { contactNumber },
                ],
            },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or contact number",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate username if not provided
        const username = req.body.username || `${email.split("@")[0]}${Math.floor(Math.random() * 1000)}`;

        // Create sub-admin
        const subAdmin = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email?.toLowerCase(),
                username,
                password: hashedPassword,
                contactNumber,
                countryCode: countryCode || "+1",
                userType: userType || "sub_admin",
                displayName: `${firstName} ${lastName}`,
                status: "active",
            },
        });

        res.status(201).json({
            success: true,
            message: "Sub-admin created successfully",
            data: {
                id: subAdmin.id,
                firstName: subAdmin.firstName,
                lastName: subAdmin.lastName,
                email: subAdmin.email,
                userType: subAdmin.userType,
            },
        });
    } catch (error) {
        console.error("Create sub-admin error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create sub-admin",
        });
    }
};

// @desc    Update sub-admin
// @route   PUT /api/sub-admin/:id
// @access  Private (Admin)
export const updateSubAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            countryCode,
            userType,
        } = req.body;

        const subAdmin = await prisma.user.findUnique({
            where: { id: parseInt(id) },
        });

        if (!subAdmin || ["admin", "rider", "driver"].includes(subAdmin.userType)) {
            return res.status(404).json({
                success: false,
                message: "Sub-admin not found",
            });
        }

        const updateData = {
            firstName,
            lastName,
            email: email?.toLowerCase(),
            contactNumber,
            countryCode,
            userType,
            displayName: `${firstName} ${lastName}`,
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updated = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            message: "Sub-admin updated successfully",
            data: {
                id: updated.id,
                firstName: updated.firstName,
                lastName: updated.lastName,
                email: updated.email,
                userType: updated.userType,
            },
        });
    } catch (error) {
        console.error("Update sub-admin error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update sub-admin",
        });
    }
};

// @desc    Delete sub-admin
// @route   DELETE /api/sub-admin/:id
// @access  Private (Admin)
export const deleteSubAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const subAdmin = await prisma.user.findUnique({
            where: { id: parseInt(id) },
        });

        if (!subAdmin || ["admin", "rider", "driver"].includes(subAdmin.userType)) {
            return res.status(404).json({
                success: false,
                message: "Sub-admin not found",
            });
        }

        await prisma.user.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Sub-admin deleted successfully",
        });
    } catch (error) {
        console.error("Delete sub-admin error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete sub-admin",
        });
    }
};

// @desc    Get sub-admin detail
// @route   GET /api/sub-admin/:id
// @access  Private (Admin)
export const getSubAdminDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const subAdmin = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                username: true,
                contactNumber: true,
                countryCode: true,
                userType: true,
                status: true,
                lastActivedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!subAdmin || ["admin", "rider", "driver"].includes(subAdmin.userType)) {
            return res.status(404).json({
                success: false,
                message: "Sub-admin not found",
            });
        }

        res.json({
            success: true,
            data: subAdmin,
        });
    } catch (error) {
        console.error("Get sub-admin detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



