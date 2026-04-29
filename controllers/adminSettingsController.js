import prisma from "../utils/prisma.js";
import { getDriverRejectionSettings } from "../utils/settingsHelper.js";

// ─── Driver Rejection Block Settings ─────────────────────────────────────────

/**
 * GET /api/admin/settings/driver-rejection
 * Returns the three driver-rejection settings with their current values.
 */
export const getDriverRejectionConfig = async (req, res) => {
    try {
        const settings = await getDriverRejectionSettings();

        return res.json({
            success: true,
            data: {
                enabled: settings.enabled,
                maxCount: settings.maxCount,
                cooldownHours: settings.cooldownHours,
                description: {
                    enabled: "When true, drivers who reject more than `maxCount` rides will be temporarily blocked.",
                    maxCount: "Number of rejected rides allowed before a driver is blocked.",
                    cooldownHours: "How long (in hours) the driver is blocked once they exceed `maxCount` rejections.",
                },
            },
        });
    } catch (err) {
        console.error("getDriverRejectionConfig error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to load settings" });
    }
};

/**
 * PUT /api/admin/settings/driver-rejection
 * Update one or more of the three driver-rejection settings.
 * Body: { enabled?: boolean, maxCount?: number, cooldownHours?: number }
 */
export const updateDriverRejectionConfig = async (req, res) => {
    try {
        const { enabled, maxCount, cooldownHours } = req.body;
        const updates = [];

        if (enabled !== undefined) {
            if (typeof enabled !== "boolean") {
                return res.status(400).json({ success: false, message: "`enabled` must be a boolean (true/false)" });
            }
            updates.push(
                prisma.setting.upsert({
                    where: { key: "driver_rejection_block_enabled" },
                    update: { value: enabled ? "1" : "0" },
                    create: { key: "driver_rejection_block_enabled", value: enabled ? "1" : "0" },
                })
            );
        }

        if (maxCount !== undefined) {
            const parsed = parseInt(maxCount, 10);
            if (Number.isNaN(parsed) || parsed < 1 || parsed > 50) {
                return res.status(400).json({ success: false, message: "`maxCount` must be an integer between 1 and 50" });
            }
            updates.push(
                prisma.setting.upsert({
                    where: { key: "driver_rejection_max_count" },
                    update: { value: String(parsed) },
                    create: { key: "driver_rejection_max_count", value: String(parsed) },
                })
            );
        }

        if (cooldownHours !== undefined) {
            const parsed = parseFloat(cooldownHours);
            if (Number.isNaN(parsed) || parsed <= 0 || parsed > 720) {
                return res.status(400).json({ success: false, message: "`cooldownHours` must be a number between 0.5 and 720" });
            }
            updates.push(
                prisma.setting.upsert({
                    where: { key: "driver_rejection_cooldown_duration" },
                    update: { value: String(parsed) },
                    create: { key: "driver_rejection_cooldown_duration", value: String(parsed) },
                })
            );
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided. Send at least one of: enabled, maxCount, cooldownHours",
            });
        }

        await prisma.$transaction(updates);

        // Return the full updated settings object
        const updated = await getDriverRejectionSettings();

        return res.json({
            success: true,
            message: "Driver rejection settings updated successfully",
            data: updated,
        });
    } catch (err) {
        console.error("updateDriverRejectionConfig error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to update settings" });
    }
};

/**
 * DELETE /api/admin/settings/driver-rejection/reset-driver/:driverId
 * Manually reset a specific driver's rejection count + unblock them.
 */
export const resetDriverRejectionCount = async (req, res) => {
    try {
        const driverId = parseInt(req.params.driverId, 10);
        if (Number.isNaN(driverId)) {
            return res.status(400).json({ success: false, message: "Invalid driverId" });
        }

        const driver = await prisma.user.findUnique({
            where: { id: driverId },
            select: { id: true, firstName: true, lastName: true, driverRejectionCount: true },
        });

        if (!driver) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        await prisma.user.update({
            where: { id: driverId },
            data: { driverRejectionCount: 0, lastRejectionAt: null },
        });

        return res.json({
            success: true,
            message: `Driver ${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() + " has been unblocked and their rejection count has been reset.",
            data: { driverId, previousCount: driver.driverRejectionCount, newCount: 0 },
        });
    } catch (err) {
        console.error("resetDriverRejectionCount error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to reset driver" });
    }
};
