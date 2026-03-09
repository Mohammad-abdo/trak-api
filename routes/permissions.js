import express from "express";
import {
    getPermissionList,
    createPermission,
    updatePermission,
    deletePermission,
    assignPermissions,
    getAllPermissionsFlat,
} from "../controllers/permissionController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getPermissionList);
router.get("/all-flat", authenticate, authorize("admin"), getAllPermissionsFlat);
router.post("/", authenticate, authorize("admin"), createPermission);
router.post("/assign", authenticate, authorize("admin"), assignPermissions);
router.put("/:id", authenticate, authorize("admin"), updatePermission);
router.delete("/:id", authenticate, authorize("admin"), deletePermission);

export default router;



