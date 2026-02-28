import express from "express";
import {
    getWithdrawRequestList,
    saveWithdrawRequest,
    updateWithdrawRequest,
    deleteWithdrawRequest,
    updateWithdrawRequestStatus,
} from "../controllers/withdrawRequestController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/withdrawrequest-list", authenticate, getWithdrawRequestList);
router.post("/save-withdrawrequest", authenticate, saveWithdrawRequest);
router.put("/:id", authenticate, authorize("admin"), updateWithdrawRequest);
router.delete("/:id", authenticate, authorize("admin"), deleteWithdrawRequest);
router.post("/update-status/:id", authenticate, authorize("admin"), updateWithdrawRequestStatus);

export default router;


