import express from "express";
import { 
    getRegionList, 
    getRegionDetail, 
    createRegion, 
    updateRegion, 
    deleteRegion 
} from "../controllers/regionController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

// Support both /regions and /regions/region-list
router.get(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("services.view", "settings.view"),
    getRegionList
);
router.get(
    "/region-list",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("services.view", "settings.view"),
    getRegionList
);
router.get(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("services.view", "settings.view"),
    getRegionDetail
);
router.post(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("services.create", "services.update", "settings.update"),
    createRegion
);
router.put(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("services.update", "services.create", "settings.update"),
    updateRegion
);
router.delete(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("services.delete", "services.update", "settings.update"),
    deleteRegion
);

export default router;

