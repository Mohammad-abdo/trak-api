import express from "express";
import {
    getServiceCategories,
    getServiceCategoryById,
    createServiceCategory,
    updateServiceCategory,
    deleteServiceCategory,
} from "../controllers/serviceCategoryController.js";

const router = express.Router();

// Public routes
router.get("/", getServiceCategories);
router.get("/:id", getServiceCategoryById);

// Admin routes (add authentication middleware as needed)
router.post("/", createServiceCategory);
router.put("/:id", updateServiceCategory);
router.delete("/:id", deleteServiceCategory);

export default router;
