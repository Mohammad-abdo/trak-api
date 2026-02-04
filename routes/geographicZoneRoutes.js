import express from "express";
import {
    getGeographicZones,
    getGeographicZoneById,
    findZoneByLocation,
    createGeographicZone,
    updateGeographicZone,
    deleteGeographicZone,
} from "../controllers/geographicZoneController.js";

const router = express.Router();

// Public routes
router.get("/", getGeographicZones);
router.get("/:id", getGeographicZoneById);
router.post("/find-by-location", findZoneByLocation);

// Admin routes
router.post("/", createGeographicZone);
router.put("/:id", updateGeographicZone);
router.delete("/:id", deleteGeographicZone);

export default router;
