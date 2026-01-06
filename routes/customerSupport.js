import express from "express";
import {
    getCustomerSupportList,
    getCustomerSupportDetail,
    createCustomerSupport,
    updateCustomerSupportStatus,
    deleteCustomerSupport,
} from "../controllers/customerSupportController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.get("/", authenticate, getCustomerSupportList);
router.get("/:id", authenticate, getCustomerSupportDetail);
router.post("/", authenticate, createCustomerSupport);
router.put("/:id/status", authenticate, authorize("admin"), updateCustomerSupportStatus);
router.delete("/:id", authenticate, authorize("admin"), deleteCustomerSupport);

export default router;


