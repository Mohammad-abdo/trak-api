import express from "express";
import {
    getSurgePriceList,
    createSurgePrice,
    updateSurgePrice,
    deleteSurgePrice,
} from "../controllers/surgePriceController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getSurgePriceList);
router.post("/", authenticate, authorize("admin"), createSurgePrice);
router.put("/:id", authenticate, authorize("admin"), updateSurgePrice);
router.delete("/:id", authenticate, authorize("admin"), deleteSurgePrice);

export default router;



