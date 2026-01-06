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
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/get-setting", authenticate, getSetting);
router.post("/save-setting", authenticate, saveSetting);
router.get("/get-appsetting", authenticate, getAppSetting);
router.post("/update-appsetting", authenticate, updateAppSetting);
router.get("/category/:category", authenticate, authorize("admin"), getSettingsByCategory);
router.post("/payment", authenticate, authorize("admin"), updatePaymentSettings);
router.post("/wallet", authenticate, authorize("admin"), updateWalletSettings);
router.post("/ride", authenticate, authorize("admin"), updateRideSettings);
router.post("/notification", authenticate, authorize("admin"), updateNotificationSettings);
router.post("/sms", authenticate, authorize("admin"), updateSMSSettings);
router.post("/mail-template", authenticate, authorize("admin"), updateMailTemplateSettings);

export default router;



