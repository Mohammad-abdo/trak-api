import express from "express";
import {
    getPushNotificationList,
    createPushNotification,
    updatePushNotification,
    deletePushNotification,
} from "../controllers/pushNotificationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getPushNotificationList);
router.post("/", authenticate, authorize("admin"), createPushNotification);
router.put("/:id", authenticate, authorize("admin"), updatePushNotification);
router.delete("/:id", authenticate, authorize("admin"), deletePushNotification);

export default router;



