import express from "express";
import {
    adminEarning,
    driverEarning,
    serviceWiseReport,
    driverReport,
    exportAdminEarning,
    exportDriverEarning,
} from "../controllers/reportController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication and admin role
router.get("/admin-earning", authenticate, authorize("admin"), adminEarning);
router.get("/admin-earning/export", authenticate, authorize("admin"), exportAdminEarning);
router.get("/driver-earning", authenticate, authorize("admin"), driverEarning);
router.get("/driver-earning/export", authenticate, authorize("admin"), exportDriverEarning);
router.get("/service-wise", authenticate, authorize("admin"), serviceWiseReport);
router.get("/driver-report", authenticate, authorize("admin"), driverReport);

export default router;



