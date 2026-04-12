import express from "express";
import {
    adminEarning,
    driverEarning,
    serviceWiseReport,
    driverReport,
    exportAdminEarning,
    exportDriverEarning,
} from "../controllers/reportController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

// Admin or sub_admin with reports permissions
router.get(
    "/admin-earning",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("reports.view", "reports.export"),
    adminEarning
);
router.get(
    "/admin-earning/export",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("reports.export"),
    exportAdminEarning
);
router.get(
    "/driver-earning",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("reports.view", "reports.export"),
    driverEarning
);
router.get(
    "/driver-earning/export",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("reports.export"),
    exportDriverEarning
);
router.get(
    "/service-wise",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("reports.view", "reports.export"),
    serviceWiseReport
);
router.get(
    "/driver-report",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("reports.view", "reports.export"),
    driverReport
);

export default router;



