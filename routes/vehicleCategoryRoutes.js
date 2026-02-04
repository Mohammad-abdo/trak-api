import express from "express";
import {
    getVehicleCategories,
    getVehicleCategoryById,
    getAvailableCategories,
    createVehicleCategory,
    updateVehicleCategory,
    deleteVehicleCategory,
} from "../controllers/vehicleCategoryController.js";

const router = express.Router();

// Public routes
router.get("/", getVehicleCategories);
router.get("/:id", getVehicleCategoryById);
router.post("/available", getAvailableCategories);

// Admin routes
router.post("/", createVehicleCategory);
router.put("/:id", updateVehicleCategory);
router.delete("/:id", deleteVehicleCategory);

export default router;
