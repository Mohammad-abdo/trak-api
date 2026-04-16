import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";

const SUPPORTED_DASHBOARD_STAFF_TYPES = new Set(["sub_admin"]);

function normalizeStaffUserType(userType) {
    const normalized = String(userType || "").trim().toLowerCase();
    if (SUPPORTED_DASHBOARD_STAFF_TYPES.has(normalized)) return normalized;
    return "sub_admin";
}

const staffSelect = {
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
    updatedAt: true,
    userRoles: {
        include: {
            role: {
                include: {
                    rolePermissions: { include: { permission: true } },
                },
            },
        },
    },
};

function formatStaff(user) {
    const role = user.userRoles?.[0]?.role || null;
    return {
        ...user,
        role: role
            ? {
                  id: role.id,
                  name: role.name,
                  permissions: role.rolePermissions?.map((rp) => rp.permission) || [],
              }
            : null,
        userRoles: undefined,
    };
}

// @desc    Get sub-admin list
// @route   GET /api/sub-admin
// @access  Private (Admin)
export const getSubAdminList = async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = {
            userType: { notIn: ["admin", "rider", "driver"] },
        };

        if (status) where.status = status;

        if (search) {
            where.OR = [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { contactNumber: { contains: search } },
            ];
        }

        const subAdmins = await prisma.user.findMany({
            where,
            select: staffSelect,
            orderBy: { createdAt: "desc" },
        });

        res.json({ success: true, data: subAdmins.map(formatStaff) });
    } catch (error) {
        console.error("Get sub-admin list error:", error);
        res.status(500).json({ success: false, message: error.message });
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
            roleId,
        } = req.body;

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email: email?.toLowerCase() }, { contactNumber }],
            },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or contact number",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const username =
            req.body.username || `${email.split("@")[0]}${Math.floor(Math.random() * 1000)}`;

        const normalizedUserType = normalizeStaffUserType(userType);

        const subAdmin = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email?.toLowerCase(),
                username,
                password: hashedPassword,
                contactNumber,
                countryCode: countryCode || "+1",
                userType: normalizedUserType,
                displayName: `${firstName} ${lastName}`,
                status: "active",
                ...(roleId && {
                    userRoles: { create: { roleId: parseInt(roleId) } },
                }),
            },
            select: staffSelect,
        });

        res.status(201).json({
            success: true,
            message: "Staff member created successfully",
            data: formatStaff(subAdmin),
        });
    } catch (error) {
        console.error("Create sub-admin error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to create staff member",
        });
    }
};

// @desc    Update sub-admin
// @route   PUT /api/sub-admin/:id
// @access  Private (Admin)
export const updateSubAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = parseInt(id);
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            countryCode,
            userType,
            roleId,
        } = req.body;

        const subAdmin = await prisma.user.findUnique({ where: { id: userId } });

        if (!subAdmin || ["admin", "rider", "driver"].includes(subAdmin.userType)) {
            return res.status(404).json({ success: false, message: "Staff member not found" });
        }

        const normalizedUserType = normalizeStaffUserType(userType ?? subAdmin.userType);

        const updateData = {
            firstName,
            lastName,
            email: email?.toLowerCase(),
            contactNumber,
            countryCode,
            userType: normalizedUserType,
            displayName: `${firstName} ${lastName}`,
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        await prisma.user.update({ where: { id: userId }, data: updateData });

        if (roleId !== undefined) {
            await prisma.userRole.deleteMany({ where: { userId } });
            if (roleId) {
                await prisma.userRole.create({
                    data: { userId, roleId: parseInt(roleId) },
                });
            }
        }

        const updated = await prisma.user.findUnique({
            where: { id: userId },
            select: staffSelect,
        });

        res.json({
            success: true,
            message: "Staff member updated successfully",
            data: formatStaff(updated),
        });
    } catch (error) {
        console.error("Update sub-admin error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to update staff member",
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
            return res.status(404).json({ success: false, message: "Staff member not found" });
        }

        await prisma.user.delete({ where: { id: parseInt(id) } });

        res.json({ success: true, message: "Staff member deleted successfully" });
    } catch (error) {
        console.error("Delete sub-admin error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to delete staff member",
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
            select: staffSelect,
        });

        if (!subAdmin || ["admin", "rider", "driver"].includes(subAdmin.userType)) {
            return res.status(404).json({ success: false, message: "Staff member not found" });
        }

        res.json({ success: true, data: formatStaff(subAdmin) });
    } catch (error) {
        console.error("Get sub-admin detail error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
