import express from "express";
import {
    getTouristTrips,
    getTouristTripById,
    createTouristTrip,
    updateTouristTrip,
    assignDriver,
    updateTripStatus,
    deleteTouristTrip,
} from "../controllers/touristTripController.js";

const router = express.Router();

// Protected routes (add authentication middleware)
router.get("/", getTouristTrips);
router.get("/:id", getTouristTripById);
router.post("/", createTouristTrip);
router.put("/:id", updateTouristTrip);
router.put("/:id/assign-driver", assignDriver);
router.put("/:id/status", updateTripStatus);
router.delete("/:id", deleteTouristTrip);

export default router;
