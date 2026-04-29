import express from "express";
import {
    getSetting,
    saveSetting,
    getAppSetting,
    updateAppSetting,
} from "../controllers/settingController.js";
import {
    updatePaymentSettings,
    updateWalletSettings,
    updateRideSettings,
    updateNotificationSettings,
    updateSMSSettings,
    updateMailTemplateSettings,
    getSettingsByCategory,
    updateDriverRejectionSettings,
} from "../controllers/settingControllerAdvanced.js";
import { resetDriverRejectionCount } from "../controllers/adminSettingsController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

router.get(
    "/get-setting",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.view", "settings.update"),
    getSetting
);
router.post(
    "/save-setting",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    saveSetting
);
router.get(
    "/get-appsetting",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.view", "settings.update"),
    getAppSetting
);
router.post(
    "/update-appsetting",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateAppSetting
);
router.get(
    "/category/:category",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.view", "settings.update"),
    getSettingsByCategory
);
router.post(
    "/payment",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updatePaymentSettings
);
router.post(
    "/wallet",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateWalletSettings
);
router.post(
    "/ride",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateRideSettings
);
router.post(
    "/notification",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateNotificationSettings
);
router.post(
    "/sms",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateSMSSettings
);
router.post(
    "/mail-template",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateMailTemplateSettings
);

// ─── Driver Rejection Block Settings ─────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Admin Settings - Driver Rejection
 *     description: |
 *       Control how many rides a driver can reject before being temporarily blocked.
 *
 *       | Setting | Description | Default |
 *       |---------|-------------|---------|
 *       | `enabled` | Feature on/off | `true` |
 *       | `maxCount` | Max rejections allowed before block | `3` |
 *       | `cooldownHours` | Block duration in hours | `24` |
 */

/**
 * @swagger
 * /api/settings/category/driver-rejection:
 *   get:
 *     tags: [Admin Settings - Driver Rejection]
 *     summary: Get driver rejection block settings
 *     description: Returns the three driver-rejection settings with their current values and defaults.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current driver rejection settings
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 enabled: true
 *                 maxCount: 3
 *                 cooldownHours: 24
 */

/**
 * @swagger
 * /api/settings/driver-rejection:
 *   post:
 *     tags: [Admin Settings - Driver Rejection]
 *     summary: Update driver rejection block settings
 *     description: |
 *       Update one or more rejection settings. Send only the fields you want to change.
 *
 *       **Examples:**
 *       - Disable the feature: `{ "enabled": false }`
 *       - Allow 5 rejections before block: `{ "maxCount": 5 }`
 *       - Set 12-hour block: `{ "cooldownHours": 12 }`
 *       - Full update: `{ "enabled": true, "maxCount": 5, "cooldownHours": 12 }`
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: true
 *                 description: "true = active, false = drivers can reject freely with no penalty"
 *               maxCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 example: 3
 *                 description: "Rejections allowed before block. Range: 1–50."
 *               cooldownHours:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 720
 *                 example: 24
 *                 description: "Block duration in hours. Range: 0.5 (30 min) – 720 (30 days)."
 *     responses:
 *       200:
 *         description: Settings saved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Driver rejection settings updated successfully
 *       400:
 *         description: Validation error
 */
router.post(
    "/driver-rejection",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    updateDriverRejectionSettings
);

/**
 * @swagger
 * /api/settings/driver-rejection/reset-driver/{driverId}:
 *   delete:
 *     tags: [Admin Settings - Driver Rejection]
 *     summary: Manually unblock a specific driver
 *     description: |
 *       Resets the driver's rejection count to 0 and clears the block timer.
 *       Use this when an admin wants to manually unblock a driver before the cooldown expires.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 7
 *         description: The driver's user ID
 *     responses:
 *       200:
 *         description: Driver unblocked
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Mohamed Hassan has been unblocked and their rejection count has been reset."
 *               data:
 *                 driverId: 7
 *                 previousCount: 3
 *                 newCount: 0
 *       404:
 *         description: Driver not found
 */
router.delete(
    "/driver-rejection/reset-driver/:driverId",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("settings.update"),
    resetDriverRejectionCount
);

export default router;



