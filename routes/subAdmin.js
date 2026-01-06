import express from "express";
import {
    getSubAdminList,
    createSubAdmin,
    updateSubAdmin,
    deleteSubAdmin,
    getSubAdminDetail,
} from "../controllers/subAdminController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getSubAdminList);
router.get("/:id", authenticate, authorize("admin"), getSubAdminDetail);
router.post("/", authenticate, authorize("admin"), createSubAdmin);
router.put("/:id", authenticate, authorize("admin"), updateSubAdmin);
router.delete("/:id", authenticate, authorize("admin"), deleteSubAdmin);

export default router;



