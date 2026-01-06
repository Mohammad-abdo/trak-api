import prisma from "../utils/prisma.js";

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
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            await prisma.setting.upsert({
                where: { key },
                update: { value: String(value) },
                create: { key, value: String(value) },
            });
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



