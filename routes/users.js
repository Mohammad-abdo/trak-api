import express from "express";
import {
    getUserList,
    getUserDetail,
    createUser,
    updateUser,
    deleteUser,
    updateProfile,
    changePassword,
    updateUserStatus,
    deleteUserAccount,
    getAppSetting,
    exportUsers,
} from "../controllers/userController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.get("/user-list", getUserList);
router.get("/get-appsetting", getAppSetting);

// Authenticated routes
router.get("/user-detail", authenticate, getUserDetail);
router.post("/update-profile", authenticate, updateProfile);
router.post("/change-password", authenticate, changePassword);
router.post("/update-user-status", authenticate, updateUserStatus);
router.post("/delete-user-account", authenticate, deleteUserAccount);

// Admin CRUD routes
router.post("/", authenticate, authorize("admin"), createUser);
router.put("/:id", authenticate, authorize("admin"), updateUser);
router.delete("/:id", authenticate, authorize("admin"), deleteUser);

// Export route
router.get("/export", authenticate, authorize("admin"), exportUsers);

export default router;
