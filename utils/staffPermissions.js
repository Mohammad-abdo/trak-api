import prisma from "./prisma.js";

/**
 * Flat permission names for RBAC (dashboard staff).
 * Admin bypass is represented as wildcard.
 * @param {number} userId
 * @param {string | null | undefined} userType
 * @returns {Promise<{ permissionNames: string[]; isDashboardAdmin: boolean }>}
 */
export async function getDashboardPermissionPayload(userId, userType) {
    if (userType === "admin") {
        return { permissionNames: ["*"], isDashboardAdmin: true };
    }

    const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: {
            role: {
                include: {
                    rolePermissions: {
                        include: { permission: true },
                    },
                },
            },
        },
    });

    const names = new Set();
    for (const ur of userRoles) {
        for (const rp of ur.role.rolePermissions) {
            if (rp.permission?.name) names.add(rp.permission.name);
        }
    }

    return {
        permissionNames: Array.from(names),
        isDashboardAdmin: false,
    };
}

/**
 * @param {number} userId
 * @param {string | null | undefined} userType
 * @param {string[]} permissionNames
 * @returns {Promise<boolean>}
 */
export async function userHasAnyPermission(userId, userType, permissionNames) {
    const payload = await getDashboardPermissionPayload(userId, userType);
    if (payload.isDashboardAdmin || payload.permissionNames.includes("*")) return true;
    return permissionNames.some((n) => payload.permissionNames.includes(n));
}
