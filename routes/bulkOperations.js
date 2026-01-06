import express from "express";
import {
    bulkDeleteUsers,
    bulkDeleteRideRequests,
    bulkUpdateUserStatus,
    bulkDeleteDrivers,
    bulkDeleteRiders,
} from "../controllers/bulkOperationsController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();

// Configure multer for file uploads (for future bulk import features)
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication and admin role
router.post("/users/delete", authenticate, authorize("admin"), bulkDeleteUsers);
router.post("/users/update-status", authenticate, authorize("admin"), bulkUpdateUserStatus);
router.post("/drivers/delete", authenticate, authorize("admin"), bulkDeleteDrivers);
router.post("/riders/delete", authenticate, authorize("admin"), bulkDeleteRiders);
router.post("/ride-requests/delete", authenticate, authorize("admin"), bulkDeleteRideRequests);

export default router;

