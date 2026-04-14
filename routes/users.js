import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
    getUserList,
    getUserDetail,
    getUserProfile,
    getDriverRides,
    createUser,
    updateUser,
    deleteUser,
    updateProfile,
    changePassword,
    updateUserStatus,
    deleteUserAccount,
    getAppSetting,
    exportUsers,
    createDriver,
    updateDriver,
} from "../controllers/userController.js";
import { authenticate, authorize, authorizeAnyPermission } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const driverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.fieldname === "documents" || file.fieldname.startsWith("documents")
            ? path.join(__dirname, "../uploads/driver-documents")
            : path.join(__dirname, "../uploads/drivers");
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const prefix = file.fieldname.startsWith("documents") ? "doc" : file.fieldname;
        cb(null, `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e4)}${path.extname(file.originalname)}`);
    },
});
const driverUpload = multer({
    storage: driverStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf/;
        const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
        cb(ok ? null : new Error("Only images and PDF files are allowed"), ok);
    },
});
const driverFields = driverUpload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "carImage", maxCount: 1 },
    { name: "documents", maxCount: 10 },
]);

const router = express.Router();

// Public routes
router.get("/get-appsetting", getAppSetting);

// Staff-only: listing users (PII) — requires dashboard staff + directory permission
router.get(
    "/user-list",
    authenticate,
    authorize("admin", "sub_admin"),
    authorizeAnyPermission("users.view", "drivers.view", "riders.view"),
    getUserList
);

// Authenticated routes
router.get("/user-detail", authenticate, getUserDetail);
router.post("/update-profile", authenticate, updateProfile);
router.post("/change-password", authenticate, changePassword);
router.post("/update-user-status", authenticate, updateUserStatus);
router.post("/delete-user-account", authenticate, deleteUserAccount);

// Admin driver CRUD (with file uploads) — must be before /:id routes
router.post("/drivers", authenticate, authorize("admin"), driverFields, createDriver);
router.put("/drivers/:id", authenticate, authorize("admin"), driverFields, updateDriver);

// Export route
router.get("/export", authenticate, authorize("admin"), exportUsers);

// Admin read routes
router.get("/:id/profile", authenticate, authorize("admin"), getUserProfile);
router.get("/:id/rides", authenticate, authorize("admin"), getDriverRides);

// Admin CRUD routes
router.post("/", authenticate, authorize("admin"), createUser);
router.put("/:id", authenticate, authorize("admin"), updateUser);
router.delete("/:id", authenticate, authorize("admin"), deleteUser);

export default router;
