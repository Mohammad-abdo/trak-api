import express from "express";
import {
    getPushNotificationList,
    createPushNotification,
    updatePushNotification,
    deletePushNotification,
} from "../controllers/pushNotificationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /api/push-notifications:
 *   post:
 *     tags: [Push Notifications]
 *     summary: Create and send push notification from admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message, user_type]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Driver Alert
 *               message:
 *                 type: string
 *                 example: New incentive available now.
 *               user_type:
 *                 type: string
 *                 enum: [driver, rider, all]
 *                 example: driver
 *               user_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [12, 45]
 *                 description: Optional specific user ids
 *               image_url:
 *                 type: string
 *                 nullable: true
 *               data:
 *                 type: object
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Notification created and sent
 *         content:
 *           application/json:
 *             examples:
 *               driver:
 *                 value:
 *                   success: true
 *                   message: Push notification created and sent successfully
 *                   data:
 *                     notification:
 *                       id: 101
 *                       title: Driver Alert
 *                       message: New incentive available now.
 *                       forRider: false
 *                       forDriver: true
 *                     sent:
 *                       total: 42
 *                       onesignal: 30
 *                       fcm: 34
 *               rider:
 *                 value:
 *                   success: true
 *                   message: Push notification created and sent successfully
 *                   data:
 *                     notification:
 *                       id: 102
 *                       title: Rider Promo
 *                       message: Use promo code OFFER20 today.
 *                       forRider: true
 *                       forDriver: false
 *                     sent:
 *                       total: 58
 *                       onesignal: 40
 *                       fcm: 45
 */
router.get("/", authenticate, authorize("admin"), getPushNotificationList);
router.post("/", authenticate, authorize("admin"), createPushNotification);
router.put("/:id", authenticate, authorize("admin"), updatePushNotification);
router.delete("/:id", authenticate, authorize("admin"), deletePushNotification);

export default router;



