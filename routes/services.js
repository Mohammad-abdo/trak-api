import express from "express";
import {
    getServiceList,
    getServiceDetail,
    createService,
    updateService,
    deleteService,
    estimatePriceTime,
} from "../controllers/serviceController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/service-list", getServiceList);
router.get("/:id", getServiceDetail);
router.post("/estimate-price-time", estimatePriceTime);

// Admin CRUD routes
router.post("/", authenticate, authorize("admin"), createService);
router.put("/:id", authenticate, authorize("admin"), updateService);
router.delete("/:id", authenticate, authorize("admin"), deleteService);

export default router;
