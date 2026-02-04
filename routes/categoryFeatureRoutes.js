import express from "express";
import {
    getCategoryFeatures,
    createCategoryFeature,
    updateCategoryFeature,
    deleteCategoryFeature,
} from "../controllers/categoryFeatureController.js";

const router = express.Router();

// Public routes
router.get("/", getCategoryFeatures);

// Admin routes
router.post("/", createCategoryFeature);
router.put("/:id", updateCategoryFeature);
router.delete("/:id", deleteCategoryFeature);

export default router;
