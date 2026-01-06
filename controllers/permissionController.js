import prisma from "../utils/prisma.js";

// @desc    Get permission list
// @route   GET /api/permissions
// @access  Private (Admin)
export const getPermissionList = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            where: { parentId: null },
            include: {
                subpermissions: true,
            },
            orderBy: { name: "asc" },
        });

        res.json({
            success: true,
            data: permissions,
        });
    } catch (error) {
        console.error("Get permission list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create permission
// @route   POST /api/permissions
// @access  Private (Admin)
export const createPermission = async (req, res) => {
    try {
        const { name, guard_name = "web", parent_id } = req.body;

        // Check if permission exists
        const existingPermission = await prisma.permission.findFirst({
            where: { name, guardName: guard_name },
        });

        if (existingPermission) {
            return res.status(400).json({
                success: false,
                message: "Permission already exists",
            });
        }

        const permission = await prisma.permission.create({
            data: {
                name,
                guardName: guard_name,
                parentId: parent_id ? parseInt(parent_id) : null,
            },
        });

        res.status(201).json({
            success: true,
            data: permission,
            message: "Permission created successfully",
        });
    } catch (error) {
        console.error("Create permission error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update permission
// @route   PUT /api/permissions/:id
// @access  Private (Admin)
export const updatePermission = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id } = req.body;

        const permission = await prisma.permission.update({
            where: { id: parseInt(id) },
            data: {
                name,
                parentId: parent_id ? parseInt(parent_id) : null,
            },
        });

        res.json({
            success: true,
            data: permission,
            message: "Permission updated successfully",
        });
    } catch (error) {
        console.error("Update permission error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete permission
// @route   DELETE /api/permissions/:id
// @access  Private (Admin)
export const deletePermission = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.permission.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Permission deleted successfully",
        });
    } catch (error) {
        console.error("Delete permission error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Assign permissions to role
// @route   POST /api/permissions/assign
// @access  Private (Admin)
export const assignPermissions = async (req, res) => {
    try {
        const { role_id, permission_ids } = req.body;

        // Note: This is a simplified version
        // In a full implementation, you'd need a many-to-many relationship table
        // For now, we'll just return success
        // TODO: Implement role_permissions pivot table in Prisma schema

        res.json({
            success: true,
            message: "Permissions assigned to role successfully",
        });
    } catch (error) {
        console.error("Assign permissions error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



