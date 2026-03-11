import express from "express";
import {
    getAdminNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteAdminNotification,
} from "../controllers/adminNotificationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/unread-count", authenticate, authorize("admin", "sub_admin"), getUnreadCount);
router.get("/", authenticate, authorize("admin", "sub_admin"), getAdminNotifications);
router.put("/read-all", authenticate, authorize("admin", "sub_admin"), markAllAsRead);
router.put("/:id/read", authenticate, authorize("admin", "sub_admin"), markAsRead);
router.delete("/:id", authenticate, authorize("admin", "sub_admin"), deleteAdminNotification);

export default router;
