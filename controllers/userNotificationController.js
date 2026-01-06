import prisma from "../utils/prisma.js";
import { saveNotification } from "../utils/notificationService.js";

// @desc    Get user notifications
// @route   GET /api/user-notifications
// @access  Private
export const getUserNotifications = async (req, res) => {
    try {
        const { per_page = 20, page = 1, unread_only = false } = req.query;

        const where = {
            notifiableType: "User",
            notifiableId: req.user.id,
        };

        if (unread_only === "true") {
            where.isRead = false;
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                skip,
                take: parseInt(per_page),
                orderBy: { createdAt: "desc" },
            }),
            prisma.notification.count({ where }),
            prisma.notification.count({
                where: {
                    notifiableType: "User",
                    notifiableId: req.user.id,
                    isRead: false,
                },
            }),
        ]);

        res.json({
            success: true,
            data: notifications,
            pagination: {
                total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                total_pages: Math.ceil(total / parseInt(per_page)),
            },
            unreadCount,
        });
    } catch (error) {
        console.error("Get user notifications error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Mark notification as read
// @route   PUT /api/user-notifications/:id/read
// @access  Private
export const markNotificationAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await prisma.notification.update({
            where: { id },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        res.json({
            success: true,
            data: notification,
            message: "Notification marked as read",
        });
    } catch (error) {
        console.error("Mark notification as read error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Mark all notifications as read
// @route   PUT /api/user-notifications/read-all
// @access  Private
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        const updated = await prisma.notification.updateMany({
            where: {
                notifiableType: "User",
                notifiableId: req.user.id,
                isRead: false,
            },
            data: {
                isRead: true,
                readAt: new Date(),
            },
        });

        res.json({
            success: true,
            message: `${updated.count} notifications marked as read`,
            count: updated.count,
        });
    } catch (error) {
        console.error("Mark all notifications as read error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete notification
// @route   DELETE /api/user-notifications/:id
// @access  Private
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.notification.delete({
            where: { id },
        });

        res.json({
            success: true,
            message: "Notification deleted successfully",
        });
    } catch (error) {
        console.error("Delete notification error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

