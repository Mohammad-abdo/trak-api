import prisma from "../utils/prisma.js";

// @desc    Get role list
// @route   GET /api/roles
// @access  Private (Admin)
export const getRoleList = async (req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: {
                rolePermissions: {
                    include: { permission: true },
                },
            },
            orderBy: { name: "asc" },
        });

        const data = roles.map((r) => ({
            ...r,
            permissions: r.rolePermissions.map((rp) => rp.permission),
            rolePermissions: undefined,
        }));

        res.json({ success: true, data });
    } catch (error) {
        console.error("Get role list error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create role
// @route   POST /api/roles
// @access  Private (Admin)
export const createRole = async (req, res) => {
    try {
        const { name, guard_name = "web", permissionIds = [] } = req.body;

        const existingRole = await prisma.role.findFirst({
            where: { name, guardName: guard_name },
        });

        if (existingRole) {
            return res.status(400).json({ success: false, message: "Role already exists" });
        }

        const role = await prisma.role.create({
            data: {
                name,
                guardName: guard_name,
                ...(permissionIds.length > 0 && {
                    rolePermissions: {
                        create: permissionIds.map((pid) => ({ permissionId: parseInt(pid) })),
                    },
                }),
            },
            include: {
                rolePermissions: { include: { permission: true } },
            },
        });

        res.status(201).json({
            success: true,
            data: {
                ...role,
                permissions: role.rolePermissions.map((rp) => rp.permission),
                rolePermissions: undefined,
            },
            message: "Role created successfully",
        });
    } catch (error) {
        console.error("Create role error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private (Admin)
export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, permissionIds } = req.body;
        const roleId = parseInt(id);

        const role = await prisma.role.update({
            where: { id: roleId },
            data: { name },
        });

        if (Array.isArray(permissionIds)) {
            await prisma.rolePermission.deleteMany({ where: { roleId } });
            if (permissionIds.length > 0) {
                await prisma.rolePermission.createMany({
                    data: permissionIds.map((pid) => ({
                        roleId,
                        permissionId: parseInt(pid),
                    })),
                });
            }
        }

        const updated = await prisma.role.findUnique({
            where: { id: roleId },
            include: { rolePermissions: { include: { permission: true } } },
        });

        res.json({
            success: true,
            data: {
                ...updated,
                permissions: updated.rolePermissions.map((rp) => rp.permission),
                rolePermissions: undefined,
            },
            message: "Role updated successfully",
        });
    } catch (error) {
        console.error("Update role error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private (Admin)
export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.role.delete({ where: { id: parseInt(id) } });

        res.json({ success: true, message: "Role deleted successfully" });
    } catch (error) {
        console.error("Delete role error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
