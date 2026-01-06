import express from "express";
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
} from "../controllers/userNotificationController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, getUserNotifications);
router.put("/:id/read", authenticate, markNotificationAsRead);
router.put("/read-all", authenticate, markAllNotificationsAsRead);
router.delete("/:id", authenticate, deleteNotification);

export default router;

