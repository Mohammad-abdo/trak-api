import express from "express";
import {
    getFleetList,
    createFleet,
    updateFleet,
    deleteFleet,
    getFleetDetail,
} from "../controllers/fleetController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getFleetList);
router.post("/", authenticate, authorize("admin"), createFleet);
router.get("/:id", authenticate, authorize("admin"), getFleetDetail);
router.put("/:id", authenticate, authorize("admin"), updateFleet);
router.delete("/:id", authenticate, authorize("admin"), deleteFleet);

export default router;



