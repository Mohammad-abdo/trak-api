import prisma from "../utils/prisma.js";

// @desc    Get admin notifications
// @route   GET /api/admin-notifications
// @access  Private (admin/sub_admin)
export const getAdminNotifications = async (req, res) => {
    try {
        const { per_page = 20, page = 1, unread_only = false } = req.query;

        const where = { notifiableType: "Admin" };

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
                where: { notifiableType: "Admin", isRead: false },
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
        console.error("Get admin notifications error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get unread count only (lightweight for header polling)
// @route   GET /api/admin-notifications/unread-count
// @access  Private (admin/sub_admin)
export const getUnreadCount = async (req, res) => {
    try {
        const count = await prisma.notification.count({
            where: { notifiableType: "Admin", isRead: false },
        });
        res.json({ success: true, unreadCount: count });
    } catch (error) {
        console.error("Get unread count error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark single notification as read
// @route   PUT /api/admin-notifications/:id/read
// @access  Private (admin/sub_admin)
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
        res.json({ success: true, data: notification });
    } catch (error) {
        console.error("Mark notification as read error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark all admin notifications as read
// @route   PUT /api/admin-notifications/read-all
// @access  Private (admin/sub_admin)
export const markAllAsRead = async (req, res) => {
    try {
        const updated = await prisma.notification.updateMany({
            where: { notifiableType: "Admin", isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        res.json({ success: true, message: `${updated.count} notifications marked as read`, count: updated.count });
    } catch (error) {
        console.error("Mark all as read error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete admin notification
// @route   DELETE /api/admin-notifications/:id
// @access  Private (admin/sub_admin)
export const deleteAdminNotification = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notification.delete({ where: { id } });
        res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
        console.error("Delete admin notification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
