import express from "express";
import {
    getWithdrawRequestList,
    saveWithdrawRequest,
    updateWithdrawRequest,
    deleteWithdrawRequest,
    updateWithdrawRequestStatus,
} from "../controllers/withdrawRequestController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/withdrawrequest-list", authenticate, getWithdrawRequestList);
router.post("/save-withdrawrequest", authenticate, saveWithdrawRequest);
router.put("/:id", authenticate, updateWithdrawRequest);
router.delete("/:id", authenticate, deleteWithdrawRequest);
router.post("/update-status/:id", authenticate, updateWithdrawRequestStatus);

export default router;


