import express from "express";
import { getNotificationList } from "../controllers/notificationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Support both GET and POST for compatibility
router.get("/", authenticate, authorize("admin"), getNotificationList);
router.post("/notification-list", authenticate, getNotificationList);

export default router;
