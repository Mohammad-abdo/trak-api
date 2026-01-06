import express from "express";
import {
    getAdminLoginDeviceList,
    getAdminLoginDeviceDetail,
    logoutDevice,
    deleteAdminLoginDevice,
} from "../controllers/adminLoginDeviceController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getAdminLoginDeviceList);
router.get("/:id", authenticate, authorize("admin"), getAdminLoginDeviceDetail);
router.post("/:id/logout", authenticate, authorize("admin"), logoutDevice);
router.delete("/:id", authenticate, authorize("admin"), deleteAdminLoginDevice);

export default router;



