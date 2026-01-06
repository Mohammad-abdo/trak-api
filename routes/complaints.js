import express from "express";
import {
    getComplaintList,
    getComplaintDetail,
    saveComplaint,
    updateComplaint,
    deleteComplaint,
} from "../controllers/complaintController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Authenticated routes
router.post("/save-complaint", authenticate, saveComplaint);
router.get("/", authenticate, authorize("admin"), getComplaintList);
router.get("/:id", authenticate, getComplaintDetail);
router.put("/:id", authenticate, updateComplaint);
router.delete("/:id", authenticate, authorize("admin"), deleteComplaint);

// Legacy route for compatibility
router.post("/update-complaint/:id", authenticate, updateComplaint);

export default router;
