import express from "express";
import {
    getAdminLoginHistoryList,
    getAdminLoginHistoryDetail,
} from "../controllers/adminLoginHistoryController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getAdminLoginHistoryList);
router.get("/:id", authenticate, authorize("admin"), getAdminLoginHistoryDetail);

export default router;



