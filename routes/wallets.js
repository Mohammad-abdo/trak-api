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
} from "../controllers/walletController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Admin routes
router.get("/", authenticate, authorize("admin"), getAllWallets);
router.post("/backfill-driver-earnings", authenticate, authorize("admin"), backfillDriverEarnings);
router.post("/fix-commission-on-earnings", authenticate, authorize("admin"), fixCommissionOnRideEarnings);
router.get("/:id/history", authenticate, authorize("admin"), getWalletHistoryForAdmin);
router.get("/:id", authenticate, authorize("admin"), getWalletByIdForAdmin);
router.post(
    "/:id/transaction",
    authenticate,
    authorize("admin"),
    addWalletTransaction
);
router.post("/user/:userId/fund", authenticate, authorize("admin"), addFundsToUserWallet);

// User routes
router.get("/wallet-detail", authenticate, getWalletDetail);
router.post("/save-wallet", authenticate, saveWallet);
router.get("/wallet-list", authenticate, getWalletList);
router.get("/reward-list", authenticate, getRewardList);

export default router;
