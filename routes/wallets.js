import express from "express";
import {
    getAllWallets,
    getWalletByIdForAdmin,
    getWalletHistoryForAdmin,
    addWalletTransaction,
    backfillDriverEarnings,
    fixCommissionOnRideEarnings,
    getWalletDetail,
    saveWallet,
    getWalletList,
    getRewardList,
    addFundsToUserWallet,
} from "../controllers/wallet/index.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

// Admin / staff wallet routes (RBAC aligned with dashboard)
router.get(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.view", "wallets.manage", "wallets.withdraw"),
    getAllWallets
);
router.post(
    "/backfill-driver-earnings",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    backfillDriverEarnings
);
router.post(
    "/fix-commission-on-earnings",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    fixCommissionOnRideEarnings
);
router.get(
    "/:id/history",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.view", "wallets.manage", "wallets.withdraw"),
    getWalletHistoryForAdmin
);
router.get(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.view", "wallets.manage", "wallets.withdraw"),
    getWalletByIdForAdmin
);
router.post(
    "/:id/transaction",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    addWalletTransaction
);
router.post(
    "/user/:userId/fund",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    addFundsToUserWallet
);

// User routes
router.get("/wallet-detail", authenticate, getWalletDetail);
router.post(
    "/save-wallet",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("wallets.manage"),
    saveWallet
);
router.get("/wallet-list", authenticate, getWalletList);
router.get("/reward-list", authenticate, getRewardList);

export default router;
