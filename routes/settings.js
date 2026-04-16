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
} from "../controllers/settingControllerAdvanced.js";
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

export default router;



