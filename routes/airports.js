import express from "express";
import {
    getAirportList,
    saveAirport,
    updateAirport,
    deleteAirport,
    airportAction,
    importAirportData,
} from "../controllers/airportController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/airport-list", authenticate, getAirportList);
router.post("/airport-save", authenticate, authorize("admin"), saveAirport);
router.put("/:id", authenticate, authorize("admin"), updateAirport);
router.post("/airport-delete/:id", authenticate, authorize("admin"), deleteAirport);
router.post("/airport-action", authenticate, authorize("admin"), airportAction);
router.post("/import", authenticate, authorize("admin"), upload.single("file"), importAirportData);
router.post("/import-data", authenticate, authorize("admin"), upload.single("airport_data"), importAirportData);

export default router;


