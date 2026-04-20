import express from "express";
import {
    getPaymentList,
    savePayment,
    driverEarningList,
} from "../controllers/paymentController.js";
import {
    payskyNotification,
    payskyNotificationGetHelp,
    payskyWebhookInfo,
    payskyDebugBuildHash,
    payskyRuntimeInfo,
} from "../controllers/payskyNotificationController.js";
import { payskySimulateTripPayment } from "../controllers/payskyRealPaymentsOnlyController.js";
import { payskyInitPayment, payskyConfirmPayment } from "../controllers/payskyPaymentController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

/** PaySky OMNI Notification Services — POST is the real webhook; GET explains POST-only. */
router.get("/paysky/notification", payskyNotificationGetHelp);
router.post("/paysky/notification", payskyNotification);
/** Same handler as `/paysky/notification` — wallet top-ups use `TOPUP:` MerchantReference on either URL. */
router.post("/paysky/wallet-notification", payskyNotification);
router.get("/paysky/webhook-info", payskyWebhookInfo);
router.get(
    "/paysky/runtime-info",
    authenticate,
    authorizeAnyPermission(
        "wallets.view",
        "wallets.manage",
        "wallets.withdraw",
        "settings.view",
        "settings.update"
    ),
    payskyRuntimeInfo
);
router.post("/paysky/simulate-trip-payment", authenticate, payskySimulateTripPayment);
router.post("/paysky/init", authenticate, payskyInitPayment);
router.post("/paysky/confirm", authenticate, payskyConfirmPayment);
router.post(
    "/paysky/debug-build-hash",
    authenticate,
    authorizeAnyPermission(
        "wallets.view",
        "wallets.manage",
        "wallets.withdraw",
        "settings.view",
        "settings.update"
    ),
    payskyDebugBuildHash
);

router.get("/", authenticate, authorize("admin"), getPaymentList);
router.post("/save-payment", authenticate, savePayment);
router.post("/earning-list", authenticate, driverEarningList);

export default router;
