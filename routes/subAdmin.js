import express from "express";
import {
    getSubAdminList,
    createSubAdmin,
    updateSubAdmin,
    deleteSubAdmin,
    getSubAdminDetail,
} from "../controllers/subAdminController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("users.view", "roles.view", "roles.create"),
    getSubAdminList
);
router.get(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("users.view", "roles.view", "roles.create"),
    getSubAdminDetail
);
router.post(
    "/",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.create", "users.create"),
    createSubAdmin
);
router.put(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.update", "users.update", "roles.create"),
    updateSubAdmin
);
router.delete(
    "/:id",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("roles.delete", "users.delete"),
    deleteSubAdmin
);

export default router;



