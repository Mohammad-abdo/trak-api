import prisma from "../utils/prisma.js";
import asyncHandler from "../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../utils/serverResponse.js";

const toBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.toLowerCase().trim();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return null;
};

export const getMyPushNotificationPreference = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, userType: true, pushNotificationsEnabled: true },
    });

    if (!user) {
        return errorResponse(res, "User not found", 404);
    }

    return successResponse(
        res,
        {
            id: user.id,
            userType: user.userType,
            pushNotificationsEnabled: user.pushNotificationsEnabled,
        },
        "Push notification preference fetched"
    );
});

export const setMyPushNotificationPreference = asyncHandler(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) return errorResponse(res, "Unauthorized", 401);

    const enabled = toBoolean(req.body?.enabled);
    if (enabled === null) {
        return errorResponse(res, "enabled must be true or false", 400);
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { pushNotificationsEnabled: enabled },
        select: {
            id: true,
            userType: true,
            pushNotificationsEnabled: true,
            updatedAt: true,
        },
    });

    return successResponse(
        res,
        updated,
        enabled ? "Push notifications activated" : "Push notifications stopped"
    );
});
