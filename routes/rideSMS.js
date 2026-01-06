import express from "express";
import {
    getRideSMSList,
    getRideSMSByType,
    saveRideSMS,
    updateRideSMS,
    deleteRideSMS,
} from "../controllers/rideSMSController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getRideSMSList);
router.get("/:type", authenticate, authorize("admin"), getRideSMSByType);
router.post("/", authenticate, authorize("admin"), saveRideSMS);
router.put("/:id", authenticate, authorize("admin"), updateRideSMS);
router.delete("/:id", authenticate, authorize("admin"), deleteRideSMS);

export default router;



