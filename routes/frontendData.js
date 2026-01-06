import express from "express";
import {
    getFrontendDataList,
    getFrontendDataByType,
    createFrontendData,
    updateFrontendData,
    deleteFrontendData,
} from "../controllers/frontendDataController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/", getFrontendDataList);
router.get("/:type", getFrontendDataByType);

// Admin routes
router.post("/", authenticate, authorize("admin"), createFrontendData);
router.put("/:id", authenticate, authorize("admin"), updateFrontendData);
router.delete("/:id", authenticate, authorize("admin"), deleteFrontendData);

export default router;



