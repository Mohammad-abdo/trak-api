import prisma from "../utils/prisma.js";

// @desc    Get notification list
// @route   GET /api/notifications
// @access  Private (Admin)
export const getNotificationList = async (req, res) => {
  try {
    // Use push notifications as the notification list
    const notifications = await prisma.pushNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to recent 100
    });

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error("Get notification list error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

