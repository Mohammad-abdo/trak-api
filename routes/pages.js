import express from "express";
import {
    getPagesList,
    getPageBySlug,
    createPage,
    updatePage,
    deletePage,
} from "../controllers/pagesController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/", getPagesList);
router.get("/:slug", getPageBySlug);

// Admin routes
router.post("/", authenticate, authorize("admin"), createPage);
router.put("/:id", authenticate, authorize("admin"), updatePage);
router.delete("/:id", authenticate, authorize("admin"), deletePage);

export default router;



