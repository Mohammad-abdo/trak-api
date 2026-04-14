import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
    getVehicleCategories,
    getVehicleCategoryById,
    getAvailableCategories,
    createVehicleCategory,
    updateVehicleCategory,
    deleteVehicleCategory,
} from "../controllers/vehicleCategoryController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, path.join(__dirname, "../uploads/vehicle-categories")),
    filename: (_req, file, cb) => cb(null, `vc_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = express.Router();

// Public routes
router.get("/", getVehicleCategories);
router.get("/:id", getVehicleCategoryById);
router.post("/available", getAvailableCategories);

// Admin routes (with optional image upload)
router.post("/", upload.single("image"), createVehicleCategory);
router.put("/:id", upload.single("image"), updateVehicleCategory);
router.delete("/:id", deleteVehicleCategory);

export default router;
