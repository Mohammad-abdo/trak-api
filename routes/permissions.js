import express from "express";
import {
    getPermissionList,
    createPermission,
    updatePermission,
    deletePermission,
    assignPermissions,
    getAllPermissionsFlat,
} from "../controllers/permissionController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.view", "roles.create", "roles.update", "roles.delete"),
    getPermissionList
);
router.get(
    "/all-flat",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.view", "roles.create", "roles.update", "roles.delete"),
    getAllPermissionsFlat
);
router.post(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.create"),
    createPermission
);
router.post(
    "/assign",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.create", "roles.update"),
    assignPermissions
);
router.put(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.update"),
    updatePermission
);
router.delete(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.delete"),
    deletePermission
);

export default router;



