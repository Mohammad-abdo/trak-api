import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import adminPromotions from "./adminPromotions.js";
import adminSecurityAudit from "./adminSecurityAudit.js";
import {
    getDriverRejectionConfig,
    updateDriverRejectionConfig,
    resetDriverRejectionCount,
} from "../controllers/adminSettingsController.js";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize("admin"));

router.use("/promotions", adminPromotions);
router.use("/security-logs", adminSecurityAudit);

// ─── Driver Rejection Settings ────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Admin - Driver Rejection Settings
 *     description: |
 *       Control how many rides a driver can reject before being temporarily blocked
 *       from seeing new ride requests.
 *
 *       Three settings are available:
 *       | Setting | Key | Default |
 *       |---------|-----|---------|
 *       | Feature on/off | `driver_rejection_block_enabled` | `true` |
 *       | Max rejections | `driver_rejection_max_count` | `3` |
 *       | Block duration | `driver_rejection_cooldown_duration` (hours) | `24` |
 *
 *       When the feature is **disabled**, drivers can reject as many rides as they want
 *       without any penalty.
 */

/**
 * @swagger
 * /api/admin/settings/driver-rejection:
 *   get:
 *     tags: [Admin - Driver Rejection Settings]
 *     summary: Get current driver rejection block settings
 *     description: Returns the three settings that control driver rejection blocking.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current settings
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 enabled: true
 *                 maxCount: 3
 *                 cooldownHours: 24
 *                 description:
 *                   enabled: "When true, drivers who reject more than `maxCount` rides will be temporarily blocked."
 *                   maxCount: "Number of rejected rides allowed before a driver is blocked."
 *                   cooldownHours: "How long (in hours) the driver is blocked once they exceed `maxCount` rejections."
 */
router.get("/settings/driver-rejection", getDriverRejectionConfig);

/**
 * @swagger
 * /api/admin/settings/driver-rejection:
 *   put:
 *     tags: [Admin - Driver Rejection Settings]
 *     summary: Update driver rejection block settings
 *     description: |
 *       Update one or more of the three rejection settings. Send only the fields you want to change.
 *
 *       **Examples:**
 *       - Disable the feature entirely: `{ "enabled": false }`
 *       - Allow 5 rejections before block: `{ "maxCount": 5 }`
 *       - Set block duration to 12 hours: `{ "cooldownHours": 12 }`
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
 *                 description: "true = feature on, false = drivers can reject freely with no penalty"
 *               maxCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 example: 3
 *                 description: "How many rides a driver may reject before being blocked. Range: 1–50."
 *               cooldownHours:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 720
 *                 example: 24
 *                 description: "Block duration in hours. Range: 0.5 (30 min) to 720 (30 days)."
 *     responses:
 *       200:
 *         description: Settings updated — returns the new full config
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Driver rejection settings updated successfully
 *               data:
 *                 enabled: true
 *                 maxCount: 5
 *                 cooldownHours: 12
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "`maxCount` must be an integer between 1 and 50"
 */
router.put("/settings/driver-rejection", updateDriverRejectionConfig);

/**
 * @swagger
 * /api/admin/settings/driver-rejection/reset-driver/{driverId}:
 *   delete:
 *     tags: [Admin - Driver Rejection Settings]
 *     summary: Manually unblock a driver and reset their rejection counter
 *     description: |
 *       Useful when an admin wants to give a driver a second chance before the automatic
 *       cooldown expires. Sets `driverRejectionCount = 0` and clears `lastRejectionAt`.
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
router.delete("/settings/driver-rejection/reset-driver/:driverId", resetDriverRejectionCount);

export default router;
