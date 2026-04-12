import express from "express";
import {
    getWithdrawRequestList,
    saveWithdrawRequest,
    updateWithdrawRequest,
    deleteWithdrawRequest,
    updateWithdrawRequestStatus,
} from "../controllers/withdrawRequestController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

router.get("/withdrawrequest-list", authenticate, getWithdrawRequestList);
router.post("/save-withdrawrequest", authenticate, saveWithdrawRequest);
router.put(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    updateWithdrawRequest
);
router.delete(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    deleteWithdrawRequest
);
router.post(
    "/update-status/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage", "wallets.withdraw"),
    updateWithdrawRequestStatus
);

export default router;


