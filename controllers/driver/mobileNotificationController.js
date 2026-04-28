import prisma from "../../utils/prisma.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse, paginatedResponse } from "../../utils/serverResponse.js";

export const getDriverNotifications = asyncHandler(async (req, res) => {
    const { per_page = 20, page = 1, unread_only = "false" } = req.query;
    const where = {
        OR: [
            { notifiableType: "Driver", notifiableId: req.user.id },
            { notifiableType: "driver", notifiableId: req.user.id },
            { notifiableType: "User", notifiableId: req.user.id },
            { notifiableType: "user", notifiableId: req.user.id },
        ],
    };
    if (unread_only === "true") where.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(per_page);
    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({ where, skip, take: parseInt(per_page), orderBy: { createdAt: "desc" } }),
        prisma.notification.count({ where }),
        prisma.notification.count({
            where: {
                OR: [
                    { notifiableType: "Driver", notifiableId: req.user.id },
                    { notifiableType: "driver", notifiableId: req.user.id },
                    { notifiableType: "User", notifiableId: req.user.id },
                    { notifiableType: "user", notifiableId: req.user.id },
                ],
                isRead: false,
            },
        }),
    ]);
    return res.json({
        success: true,
        data: notifications,
        pagination: { total, page: parseInt(page), per_page: parseInt(per_page), total_pages: Math.ceil(total / parseInt(per_page)) },
        unreadCount,
    });
});

export const getDriverUnreadCount = asyncHandler(async (req, res) => {
    const count = await prisma.notification.count({
        where: {
            OR: [
                { notifiableType: "Driver", notifiableId: req.user.id },
                { notifiableType: "driver", notifiableId: req.user.id },
            ],
            isRead: false,
        },
    });
    return successResponse(res, { unreadCount: count }, "Unread notifications count retrieved");
});

export const markNotificationAsRead = asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return errorResponse(res, "Invalid notification id", 400);

    const notif = await prisma.notification.findFirst({
        where: {
            id,
            OR: [
                { notifiableType: "Driver", notifiableId: req.user.id },
                { notifiableType: "driver", notifiableId: req.user.id },
            ],
        },
        select: { id: true },
    });
    if (!notif) return errorResponse(res, "Notification not found", 404);

    const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
    });
    return successResponse(res, updated, "Notification marked as read");
});

export const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const updated = await prisma.notification.updateMany({
        where: {
            OR: [
                { notifiableType: "Driver", notifiableId: req.user.id },
                { notifiableType: "driver", notifiableId: req.user.id },
                { notifiableType: "User", notifiableId: req.user.id },
                { notifiableType: "user", notifiableId: req.user.id },
            ],
            isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
    });
    return successResponse(res, { count: updated.count }, `${updated.count} notifications marked as read`);
});
