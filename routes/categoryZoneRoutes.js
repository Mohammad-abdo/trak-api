import express from "express";
import {
    getCategoryZones,
    assignZoneToCategory,
    bulkAssignZones,
    removeCategoryZone,
} from "../controllers/categoryZoneController.js";

const router = express.Router();

// Public routes
router.get("/", getCategoryZones);

// Admin routes
router.post("/assign", assignZoneToCategory);
router.post("/bulk-assign", bulkAssignZones);
router.delete("/:id", removeCategoryZone);

export default router;
