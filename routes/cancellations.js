import express from "express";
import {
    getCancellationList,
    getAllCancellations,
    createCancellation,
    updateCancellation,
    deleteCancellation,
} from "../controllers/cancellationController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/cancelReason-list", authenticate, getCancellationList);
router.get("/", authenticate, authorize("admin"), getAllCancellations);
router.post("/", authenticate, authorize("admin"), createCancellation);
router.put("/:id", authenticate, authorize("admin"), updateCancellation);
router.delete("/:id", authenticate, authorize("admin"), deleteCancellation);

export default router;



