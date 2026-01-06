import express from "express";
import {
    getPlaceAutocomplete,
    getPlaceDetails,
    geocodeAddress,
    reverseGeocode,
    getDistanceMatrix,
} from "../controllers/placeController.js";

const router = express.Router();

// All routes are public (no authentication required)
// You may want to add rate limiting for production
router.get("/autocomplete", getPlaceAutocomplete);
router.get("/details", getPlaceDetails);
router.get("/geocode", geocodeAddress);
router.get("/reverse-geocode", reverseGeocode);
router.get("/distance-matrix", getDistanceMatrix);

export default router;

