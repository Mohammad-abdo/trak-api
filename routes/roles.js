import express from "express";
import {
    getRoleList,
    createRole,
    updateRole,
    deleteRole,
} from "../controllers/roleController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.view", "roles.create", "roles.update", "roles.delete"),
    getRoleList
);
router.post(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.create"),
    createRole
);
router.put(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.update"),
    updateRole
);
router.delete(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.delete"),
    deleteRole
);

export default router;



