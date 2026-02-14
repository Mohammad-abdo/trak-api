import express from "express";
import {
    getManageZoneList,
    saveManageZone,
    updateManageZone,
    deleteManageZone,
    getZonePrices,
    createZonePrice,
    updateZonePrice,
    deleteZonePrice,
} from "../controllers/manageZoneController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/managezone-list", authenticate, getManageZoneList);
router.get("/zone-prices", authenticate, getZonePrices);
router.post("/zone-prices", authenticate, authorize("admin"), createZonePrice);
router.put("/zone-prices/:id", authenticate, authorize("admin"), updateZonePrice);
router.delete("/zone-prices/:id", authenticate, authorize("admin"), deleteZonePrice);
router.post("/managezone-save", authenticate, authorize("admin"), saveManageZone);
router.put("/:id", authenticate, authorize("admin"), updateManageZone);
router.post("/managezone-delete/:id", authenticate, authorize("admin"), deleteManageZone);

export default router;



