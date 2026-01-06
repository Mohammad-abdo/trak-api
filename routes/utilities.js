import express from "express";
import {
    getNearByDrivers,
    getLanguageTableList,
    placeAutoComplete,
    placeDetail,
    snapToRoads,
} from "../controllers/utilityController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/near-by-driver", getNearByDrivers);
router.get("/language-table-list", getLanguageTableList);
router.get("/place-autocomplete-api", placeAutoComplete);
router.get("/place-detail-api", placeDetail);
router.post("/snap-to-roads", snapToRoads);

export default router;



