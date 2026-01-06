import express from "express";
import {
    getDispatchList,
    assignDriver,
    createDispatch,
    checkZonePrice,
    saveZoneFare,
    getSupplierPayout,
} from "../controllers/dispatchController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getDispatchList);
router.post("/", authenticate, authorize("admin"), createDispatch);
router.post("/:id/assign-driver", authenticate, authorize("admin"), assignDriver);
router.post("/check-zone-price", authenticate, authorize("admin"), checkZonePrice);
router.post("/save-zone-fare", authenticate, authorize("admin"), saveZoneFare);
router.get("/supplier-payout", authenticate, authorize("admin"), getSupplierPayout);

export default router;



