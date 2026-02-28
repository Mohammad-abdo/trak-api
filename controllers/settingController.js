import prisma from "../utils/prisma.js";
import { recalculateWalletsForNewCommissionPercentage } from "./walletController.js";

// @desc    Get settings
// @route   GET /api/settings/get-setting
// @access  Private
export const getSetting = async (req, res) => {
    try {
        const settings = await prisma.setting.findMany({
            orderBy: { key: "asc" },
        });

        const settingsObj = {};
        settings.forEach((setting) => {
            settingsObj[setting.key] = setting.value;
        });
        // ضمان وجود نسبة السستم وحفظها في DB إذا غير موجودة
        if (settingsObj.system_commission_percentage === undefined || settingsObj.system_commission_percentage === null || settingsObj.system_commission_percentage === "") {
            await prisma.setting.upsert({
                where: { key: "system_commission_percentage" },
                create: { key: "system_commission_percentage", value: "15" },
                update: { value: "15" },
            });
            settingsObj.system_commission_percentage = "15";
        }

        res.json({
            success: true,
            data: settingsObj,
        });
    } catch (error) {
        console.error("Get setting error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save setting
// @route   POST /api/settings/save-setting
// @access  Private
export const saveSetting = async (req, res) => {
    try {
        const settings = { ...req.body };
        if (settings.system_commission_percentage === undefined || settings.system_commission_percentage === null || String(settings.system_commission_percentage).trim() === "") {
            const row = await prisma.setting.findUnique({ where: { key: "system_commission_percentage" } });
            settings.system_commission_percentage = row?.value ?? "15";
        }
        const oldRow = await prisma.setting.findUnique({ where: { key: "system_commission_percentage" } });
        const oldCommissionPct = oldRow?.value != null ? parseFloat(oldRow.value) : null;

        for (const [key, value] of Object.entries(settings)) {
            await prisma.setting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            });
        }

        const newCommissionPct = settings.system_commission_percentage != null ? parseFloat(settings.system_commission_percentage) : null;
        const commissionChanged = newCommissionPct != null && !Number.isNaN(newCommissionPct) && oldCommissionPct !== newCommissionPct;
        if (commissionChanged) {
            try {
                const result = await recalculateWalletsForNewCommissionPercentage(newCommissionPct);
                return res.json({
                    success: true,
                    message: "Settings saved successfully. Wallets recalculated for new commission %.",
                    data: { commissionRecalc: result },
                });
            } catch (recalcErr) {
                console.error("Recalculate wallets on commission change error:", recalcErr);
            }
        }

        res.json({
            success: true,
            message: "Settings saved successfully",
        });
    } catch (error) {
        console.error("Save setting error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get app settings
// @route   GET /api/settings/get-appsetting
// @access  Private
export const getAppSetting = async (req, res) => {
    try {
        const appSettings = await prisma.appSetting.findMany({
            orderBy: { key: "asc" },
        });

        const settingsObj = {};
        appSettings.forEach((setting) => {
            settingsObj[setting.key] = setting.value;
        });

        res.json({
            success: true,
            data: settingsObj,
        });
    } catch (error) {
        console.error("Get app setting error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update app setting
// @route   POST /api/settings/update-appsetting
// @access  Private
export const updateAppSetting = async (req, res) => {
    try {
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            await prisma.appSetting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            });
        }

        res.json({
            success: true,
            message: "App settings updated successfully",
        });
    } catch (error) {
        console.error("Update app setting error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



