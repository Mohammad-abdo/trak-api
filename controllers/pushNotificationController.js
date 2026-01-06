import prisma from "../utils/prisma.js";

// @desc    Get push notification list
// @route   GET /api/push-notifications
// @access  Private (Admin)
export const getPushNotificationList = async (req, res) => {
    try {
        const { per_page = 10, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        const [notifications, total] = await Promise.all([
            prisma.pushNotification.findMany({
                skip,
                take: parseInt(per_page),
                orderBy: { createdAt: "desc" },
            }),
            prisma.pushNotification.count(),
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
        });
    } catch (error) {
        console.error("Get push notification list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create push notification
// @route   POST /api/push-notifications
// @access  Private (Admin)
export const createPushNotification = async (req, res) => {
    try {
        const { title, message, user_type, user_ids, image_url, data } = req.body;

        // Create notification record
        const notification = await prisma.pushNotification.create({
            data: {
                title,
                message,
                userType: user_type,
                userIds: user_ids ? JSON.stringify(user_ids) : null,
            },
        });

        // Prepare notification data
        const notificationData = {
            id: notification.id,
            push_notification_id: notification.id,
            type: "push_notification",
            subject: title,
            message: message,
            ...(image_url && { image: image_url }),
            ...(data && { ...data }),
        };

        // Get target users
        let users = [];
        if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
            users = await prisma.user.findMany({
                where: {
                    id: { in: user_ids.map(id => parseInt(id)) },
                    ...(user_type && { userType: user_type }),
                },
                select: {
                    id: true,
                    playerId: true,
                    fcmToken: true,
                },
            });
        } else if (user_type) {
            users = await prisma.user.findMany({
                where: {
                    userType: user_type,
                    status: "active",
                },
                select: {
                    id: true,
                    playerId: true,
                    fcmToken: true,
                },
            });
        }

        // Send notifications
        const { sendNotificationToUsers, saveNotification } = await import("../utils/notificationService.js");
        const sendResults = await sendNotificationToUsers(users, title, message, notificationData, image_url);

        // Save notifications to database
        for (const user of users) {
            await saveNotification(user.id, "push_notification", notificationData);
        }

        res.status(201).json({
            success: true,
            data: {
                notification,
                sent: {
                    total: users.length,
                    onesignal: sendResults.onesignal.sent,
                    fcm: sendResults.fcm.sent,
                },
            },
            message: "Push notification created and sent successfully",
        });
    } catch (error) {
        console.error("Create push notification error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update push notification
// @route   PUT /api/push-notifications/:id
// @access  Private (Admin)
export const updatePushNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, message, user_type, user_ids } = req.body;

        const notification = await prisma.pushNotification.update({
            where: { id: parseInt(id) },
            data: {
                title,
                message,
                userType: user_type,
                userIds: user_ids ? JSON.stringify(user_ids) : null,
            },
        });

        res.json({
            success: true,
            data: notification,
            message: "Push notification updated successfully",
        });
    } catch (error) {
        console.error("Update push notification error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete push notification
// @route   DELETE /api/push-notifications/:id
// @access  Private (Admin)
export const deletePushNotification = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.pushNotification.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Push notification deleted successfully",
        });
    } catch (error) {
        console.error("Delete push notification error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



