import express from "express";
import { 
    getRegionList, 
    getRegionDetail, 
    createRegion, 
    updateRegion, 
    deleteRegion 
} from "../controllers/regionController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Support both /regions and /regions/region-list
router.get("/", authenticate, getRegionList);
router.get("/region-list", authenticate, getRegionList);
router.get("/:id", authenticate, getRegionDetail);
router.post("/", authenticate, createRegion);
router.put("/:id", authenticate, updateRegion);
router.delete("/:id", authenticate, deleteRegion);

export default router;

