import prisma from "../utils/prisma.js";

// @desc    Get role list
// @route   GET /api/roles
// @access  Private (Admin)
export const getRoleList = async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { name: "asc" },
        });

        res.json({
            success: true,
            data: roles,
        });
    } catch (error) {
        console.error("Get role list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create role
// @route   POST /api/roles
// @access  Private (Admin)
export const createRole = async (req, res) => {
    try {
        const { name, guard_name = "web" } = req.body;

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { name, guardName: guard_name },
        });

        if (existingRole) {
            return res.status(400).json({
                success: false,
                message: "Role already exists",
            });
        }

        const role = await prisma.role.create({
            data: {
                name,
                guardName: guard_name,
            },
        });

        res.status(201).json({
            success: true,
            data: role,
            message: "Role created successfully",
        });
    } catch (error) {
        console.error("Create role error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private (Admin)
export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const role = await prisma.role.update({
            where: { id: parseInt(id) },
            data: { name },
        });

        res.json({
            success: true,
            data: role,
            message: "Role updated successfully",
        });
    } catch (error) {
        console.error("Update role error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private (Admin)
export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.role.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Role deleted successfully",
        });
    } catch (error) {
        console.error("Delete role error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



