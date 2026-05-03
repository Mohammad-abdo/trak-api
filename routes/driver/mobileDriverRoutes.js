import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { authenticate } from "../../middleware/auth.js";

// ─── Auth (OTP aligned with mobile user: shared validation, test OTP, token on resend) ──
import { login } from "../../controllers/driver/mobileAuthController.js";
import { submitOtp, resendOtp, sendOtp, forgotPassword, resetPassword } from "../../controllers/user/mobileAuthController.js";
import { logout } from "../../controllers/auth/login.js";

// ─── Driver profile/vehicle/docs/bank/status ─────────────────────────────────
import {
    registerDriver,
    getRegistrationServices,
    currentDriverLocation,
    getMyProfile,
    updateMyProfile,
    updateVehicle,
    uploadDocuments,
    getMyDocuments,
    getRequiredDocuments,
    updateBankAccount,
    addBankCard,
    getBankCards,
    deleteBankCard,
    updateDriverStatus,
    getRegistrationStatus,
    getRejectionStatus,
    getMyStatus,
    goOnlineOffline,
    deleteMyAccount,
} from "../../controllers/driver/mobileDriverController.js";

// ─── Rides lifecycle ─────────────────────────────────────────────────────────
import {
    getMyRides,
    getRideDetail,
    respondToRide,
    updateRideStatus,
    completeRide,
    cancelRide,
    rateRider,
    getMyRatings,
    getEarningsSummary,
    updateLocation,
    getAvailableRides,
    pollAvailableRides,
    driverProposeNegotiation,
    checkNegotiationStatus,
} from "../../controllers/driver/mobileRideController.js";

// ─── Wallet ──────────────────────────────────────────────────────────────────
import { getWalletDetail, getWalletList } from "../../controllers/wallet/balanceAndHistory.js";
import { lastUserOperations, filterOperations } from "../../controllers/user/mobileWalletController.js";
import { topupWallet, getWalletBalance } from "../../controllers/wallet/walletTopupController.js";

// ─── Withdraw requests ───────────────────────────────────────────────────────
import { getWithdrawRequestList, saveWithdrawRequest } from "../../controllers/withdrawRequestController.js";

// ─── Complaints ──────────────────────────────────────────────────────────────
import { saveComplaint, listDriverComplaints, getComplaintDetail } from "../../controllers/complaintController.js";

// ─── Notifications ───────────────────────────────────────────────────────────
import { getDriverNotifications, getDriverUnreadCount, markNotificationAsRead, markAllNotificationsAsRead } from "../../controllers/driver/mobileNotificationController.js";
import {
    getMyPushNotificationPreference,
    setMyPushNotificationPreference,
} from "../../controllers/notificationPreferenceController.js";

// ─── Static pages ────────────────────────────────────────────────────────────
import { getPrivacyPolicy, getHelpCenter, getTerms } from "../../controllers/user/mobileStaticController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ── Multer ───────────────────────────────────────────────────────────────────
const driverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isDriverDoc =
            file.fieldname === "documents" ||
            file.fieldname === "document" ||
            file.fieldname === "files";
        const dir = isDriverDoc
            ? path.join(__dirname, "../../uploads/driver-documents")
            : path.join(__dirname, "../../uploads/drivers");
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const prefix =
            file.fieldname === "documents" || file.fieldname === "document" || file.fieldname === "files"
                ? "doc"
                : file.fieldname;
        cb(null, `${prefix}_${Date.now()}_${Math.round(Math.random() * 1e4)}${path.extname(file.originalname)}`);
    },
});
const upload = multer({
    storage: driverStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    },
});
const registerUpload = upload.fields([{ name: "avatar", maxCount: 1 }, { name: "carImage", maxCount: 1 }, { name: "documents", maxCount: 10 }]);
const profileUpload = upload.fields([{ name: "avatar", maxCount: 1 }]);
const vehicleUpload = upload.fields([{ name: "carImage", maxCount: 1 }]);
// Accept common mobile field names so multer receives files (Flutter often uses "documents")
const docUpload = upload.fields([
    { name: "files", maxCount: 20 },
    { name: "documents", maxCount: 20 },
    { name: "document", maxCount: 20 },
]);

// =============================================================================
//  SWAGGER SCHEMAS
// =============================================================================
/**
 * @swagger
 * components:
 *   schemas:
 *     DriverFull:
 *       type: object
 *       properties:
 *         id: { type: integer }
 *         firstName: { type: string }
 *         lastName: { type: string }
 *         email: { type: string }
 *         contactNumber: { type: string }
 *         status: { type: string, enum: [pending, active, inactive] }
 *         isOnline: { type: boolean }
 *         isAvailable: { type: boolean }
 *         isVerifiedDriver: { type: boolean }
 *         userDetail: { type: object, nullable: true }
 *         wallet: { type: object, nullable: true }
 *         bankAccount: { type: object, nullable: true }
 *         stats: { type: object }
 */

// =============================================================================
//  1 — AUTH (public)
// =============================================================================

/** @swagger
 * /apimobile/driver/auth/register:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Register new driver with full details + vehicle + documents
 *     description: |
 *       Creates driver (status=pending). Accepts multipart/form-data.
 *       Upload any kind of documents (images, PDFs, etc.) without documentIds.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [firstName, contactNumber, password]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               confirmPassword: { type: string }
 *               contactNumber: { type: string }
 *               countryCode: { type: string }
 *               gender: { type: string, enum: [male, female] }
 *               address: { type: string }
 *               serviceId: { type: integer }
 *               carModel: { type: string }
 *               carColor: { type: string }
 *               carPlateNumber: { type: string }
 *               carProductionYear: { type: integer }
 *               bankName: { type: string }
 *               accountHolderName: { type: string }
 *               accountNumber: { type: string }
 *               bankIban: { type: string }
 *               bankSwift: { type: string }
 *               avatar: { type: string, format: binary }
 *               carImage: { type: string, format: binary }
 *               documents:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Any kind of document files (images, PDFs, etc.)
 *     responses:
 *       201: { description: Registered (pending admin approval) }
 *       400: { description: Validation error }
 */
router.post("/auth/register", registerUpload, registerDriver);

/** @swagger
 * /apimobile/driver/services:
 *   get:
 *     tags: [Driver Auth]
 *     summary: Public list of active services for driver registration
 *     description: |
 *       Returns all active services (for example Economy / Premium / XL)
 *       so driver can choose `serviceId` during registration.
 *     security: []
 *     responses:
 *       200: { description: Services list }
 */
router.get("/services", getRegistrationServices);

/** @swagger
 * /apimobile/driver/auth/login:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Login with phone + password
 *     description: Phone and password only. Do not use email to sign in on mobile (use registered phone in `phone`).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone: { type: string, example: "0501234567" }
 *               password: { type: string, example: "pass1234" }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     user: { type: object }
 *                     stats:
 *                       type: object
 *                       properties:
 *                         averageRating: { type: number }
 *                         totalRatings: { type: integer }
 *                         totalEarnings: { type: number }
 *                 message: { type: string }
 *       400: { description: Missing phone, or email used instead of phone }
 *       401: { description: Invalid credentials }
 *       403: { description: Account pending/blocked }
 */
router.post("/auth/login", login);

/** @swagger
 * /apimobile/driver/auth/resend-otp:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Resend OTP by phone (no auth)
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone: { type: string }
 *     responses:
 *       200: { description: OTP sent }
 */
router.post("/auth/resend-otp", resendOtp);

/** @swagger
 * /apimobile/driver/auth/forgot-password:
 *   post:
 *     tags: [Driver Auth]
 *     operationId: driverForgotPassword
 *     summary: Forgot password – sends OTP to phone number
 *     description: |
 *       Send the driver's registered **phone** number. If found, an OTP is sent via SMS and a temporary JWT token is returned.
 *
 *       **Flow:**
 *       1. Call this endpoint with `phone`.
 *       2. Receive `token` in the response.
 *       3. Call **POST /auth/reset-password** with the token (in Authorization header), the OTP, and the new password.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+966501111111"
 *                 description: Registered phone number
 *     responses:
 *       200:
 *         description: OTP sent successfully. Use returned token for reset-password.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string, description: "Temporary JWT – use in Authorization header for reset-password" }
 *       404:
 *         description: No account found with this phone number
 */
router.post("/auth/forgot-password", forgotPassword);

/** @swagger
 * /apimobile/driver/auth/reset-password:
 *   post:
 *     tags: [Driver Auth]
 *     operationId: driverResetPassword
 *     summary: Reset password using OTP (requires token from forgot-password)
 *     description: |
 *       After calling **forgot-password**, use the returned token in the Authorization header and provide the OTP + new password.
 *       On success the password is updated and the driver can login with the new password.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp, newPassword, confirmPassword]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *                 description: 6-digit OTP received via SMS
 *               newPassword:
 *                 type: string
 *                 example: "NewPass123"
 *                 description: New password (min 6 characters)
 *               confirmPassword:
 *                 type: string
 *                 example: "NewPass123"
 *                 description: Must match newPassword
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid/expired OTP or passwords don't match
 *       404:
 *         description: User not found
 */
router.post("/auth/reset-password", authenticate, resetPassword);

/** @swagger
 * /apimobile/driver/auth/send-otp:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Send OTP (requires token)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OTP sent }
 */
router.post("/auth/send-otp", authenticate, sendOtp);

/** @swagger
 * /apimobile/driver/auth/submit-otp:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Verify OTP
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Verified }
 */
router.post("/auth/submit-otp", authenticate, submitOtp);

/** @swagger
 * /apimobile/driver/auth/current-location:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Update current driver location (after register/login)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude: { type: number, example: 24.7136 }
 *               longitude: { type: number, example: 46.6753 }
 *     responses:
 *       200: { description: Location updated and returned }
 *       400: { description: Missing latitude or longitude }
 */
router.post("/auth/current-location", authenticate, currentDriverLocation);

/** @swagger
 * /apimobile/driver/auth/logout:
 *   post:
 *     tags: [Driver Auth]
 *     summary: Logout
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Logged out }
 */
router.post("/auth/logout", authenticate, logout);

// =============================================================================
//  2 — DOCUMENTS (public — for registration screen)
// =============================================================================

/** @swagger
 * /apimobile/driver/documents/required:
 *   get:
 *     tags: [Driver Documents]
 *     summary: Get all document types (for registration form)
 *     security: []
 *     responses:
 *       200:
 *         description: List of active document types
 */
router.get("/documents/required", getRequiredDocuments);

// =============================================================================
//  3 — PROFILE (protected)
// =============================================================================

/** @swagger
 * /apimobile/driver/profile:
 *   get:
 *     tags: [Driver Profile]
 *     summary: Get full driver profile (vehicle, docs, wallet, bank, stats)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Full profile }
 */
router.get("/profile", authenticate, getMyProfile);

/** @swagger
 * /apimobile/driver/profile/update:
 *   put:
 *     tags: [Driver Profile]
 *     summary: Update personal info + avatar
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               email: { type: string }
 *               gender: { type: string }
 *               address: { type: string }
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated }
 */
router.put("/profile/update", authenticate, profileUpload, updateMyProfile);

/** @swagger
 * /apimobile/driver/profile/delete:
 *   delete:
 *     tags: [Driver Profile]
 *     summary: Delete driver account (soft delete)
 *     description: |
 *       Marks driver account as deleted and logs the driver out from push targeting.
 *       The account record is kept for audit/history.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Driver account deleted
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Driver account deleted successfully
 *               data:
 *                 deleted: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Driver not found
 */
router.delete("/profile/delete", authenticate, deleteMyAccount);

/** @swagger
 * /apimobile/driver/profile/status:
 *   get:
 *     tags: [Driver Profile]
 *     summary: Check registration status + missing documents
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Status with canDrive flag }
 */
router.get("/profile/status", authenticate, getRegistrationStatus);

/** @swagger
 * /apimobile/driver/profile/rejection-status:
 *   get:
 *     tags: [Driver Auth]
 *     summary: Get rejection status and reason if driver was rejected
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Rejection status info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     isRejected: { type: boolean }
 *                     rejectionReason: { type: string, nullable: true }
 *                     canReapply: { type: boolean }
 */
router.get("/profile/rejection-status", authenticate, getRejectionStatus);

// =============================================================================
//  4 — VEHICLE (protected)
// =============================================================================

/** @swagger
 * /apimobile/driver/vehicle/update:
 *   put:
 *     tags: [Driver Vehicle]
 *     summary: Update vehicle info + image
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               carModel: { type: string }
 *               carColor: { type: string }
 *               carPlateNumber: { type: string }
 *               carProductionYear: { type: integer }
 *               carImage: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated }
 */
router.put("/vehicle/update", authenticate, vehicleUpload, updateVehicle);

// =============================================================================
//  5 — DOCUMENTS (protected)
// =============================================================================

/** @swagger
 * /apimobile/driver/documents:
 *   get:
 *     tags: [Driver Documents]
 *     summary: Get my uploaded documents
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of driver's uploaded documents with verification status
 */
router.get("/documents", authenticate, getMyDocuments);

/** @swagger
 * /apimobile/driver/documents/upload:
 *   post:
 *     tags: [Driver Documents]
 *     summary: Upload multiple documents (any file type)
 *     security: [{ bearerAuth: [] }]
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *               documents:
 *                 description: Same as files (alternate field name)
 *                 type: array
 *                 items: { type: string, format: binary }
 *               documentIds:
 *                 description: JSON array of document type IDs, one per file (e.g. [13,14]) — required to update existing row instead of duplicating
 *                 type: string
 *               documentId:
 *                 description: Single document type ID when uploading one file
 *                 type: integer
 *               expireDates:
 *                 description: Optional JSON array of ISO dates aligned with files
 *                 type: string
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 */
router.post("/documents/upload", authenticate, docUpload, uploadDocuments);

// =============================================================================
//  6 — BANK ACCOUNT (protected)
// =============================================================================

/** @swagger
 * /apimobile/driver/bank-account/update:
 *   put:
 *     tags: [Driver Profile]
 *     summary: Update bank account
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankName: { type: string }
 *               accountHolderName: { type: string }
 *               accountNumber: { type: string }
 *               bankIban: { type: string }
 *               bankSwift: { type: string }
 *               bankCode: { type: string }
 *               bankAddress: { type: string }
 *               routingNumber: { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.put("/bank-account/update", authenticate, updateBankAccount);

/** @swagger
 * /apimobile/driver/add-bank-card:
 *   post:
 *     tags: [Driver Cards]
 *     summary: Add a payment card (store last 4 digits + metadata only)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lastFourDigits]
 *             properties:
 *               cardHolderName: { type: string, example: "John Doe" }
 *               lastFourDigits: { type: string, example: "4242" }
 *               brand: { type: string, example: "visa" }
 *               expiryMonth: { type: integer, example: 12 }
 *               expiryYear: { type: integer, example: 2028 }
 *               isDefault: { type: boolean, default: false }
 *     responses:
 *       201: { description: Card added }
 *       400: { description: Valid last 4 digits required }
 */
router.post("/add-bank-card", authenticate, addBankCard);

/** @swagger
 * /apimobile/driver/bank-cards:
 *   get:
 *     tags: [Driver Cards]
 *     summary: Get driver's saved payment cards
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Cards list }
 */
router.get("/bank-cards", authenticate, getBankCards);

/** @swagger
 * /apimobile/driver/bank-cards/{id}:
 *   delete:
 *     tags: [Driver Cards]
 *     summary: Delete a saved payment card
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Card deleted }
 *       404: { description: Card not found }
 */
router.delete("/bank-cards/:id", authenticate, deleteBankCard);

// =============================================================================
//  7 — DRIVER STATUS (online/offline/location)
// =============================================================================

/** @swagger
 * /apimobile/driver/status/update:
 *   post:
 *     tags: [Driver Status]
 *     summary: Go online/offline, update availability & location
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isOnline: { type: boolean }
 *               isAvailable: { type: boolean }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               currentHeading: { type: number }
 *               fcmToken: { type: string }
 *     responses:
 *       200: { description: Status updated }
 */
router.post("/status/update", authenticate, updateDriverStatus);
/** @swagger
 * /apimobile/driver/status:
 *   get:
 *     tags: [Driver Status]
 *     summary: Get current online/offline and availability status
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Status object }
 */
router.get("/status", authenticate, getMyStatus);

/** @swagger
 * /apimobile/driver/status/go-online:
 *   post:
 *     tags: [Driver Status]
 *     summary: Toggle driver online/offline status
 *     description: |
 *       Toggles driver status between online and offline.
 *       - If currently offline → goes online (isOnline=true, isAvailable=true)
 *       - If currently online → goes offline (isOnline=false, isAvailable=false)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     isOnline: { type: boolean }
 *                     isAvailable: { type: boolean }
 *
 *                 message:
 *                   type: string
 */
router.post("/status/go-online", authenticate, goOnlineOffline);

/** @swagger
 * /apimobile/driver/location/update:
 *   post:
 *     tags: [Driver Status]
 *     summary: Update GPS location (during ride or idle)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude: { type: number, example: 24.7136 }
 *               longitude: { type: number, example: 46.6753 }
 *              
 *     responses:
 *       200: { description: Location updated }
 */
router.post("/location/update", authenticate, updateLocation);

// =============================================================================
//  8 — RIDES (the core driver operations)
// =============================================================================

/** @swagger
 * /apimobile/driver/rides:
 *   get:
 *     tags: [Driver Rides]
 *     summary: Get my ride history (paginated, filterable)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [all, pending, accepted, started, arrived, completed, cancelled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 15 }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Paginated ride list }
 */
router.get("/rides", authenticate, getMyRides);

/** @swagger
 * /apimobile/driver/rides/{id}:
 *   get:
 *     tags: [Driver Rides]
 *     summary: Get single ride details (with rider info, payments, ratings, negotiations)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Ride details }
 *       404: { description: Not found }
 */

/** @swagger
 * /apimobile/driver/rides/available:
 *   get:
 *     tags: [Driver Rides]
 *     summary: Get available ride requests near driver location
 *     description: |
 *       Returns a list of pending ride requests within the specified radius
 *       that the driver can accept. Excludes rides previously rejected by this driver.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema: { type: number, format: float }
 *         description: Driver's current latitude
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema: { type: number, format: float }
 *         description: Driver's current longitude
 *       - in: query
 *         name: radius
 *         schema: { type: number, format: float, default: 5 }
 *         description: Search radius in kilometers (default 5km)
 *     responses:
 *       200:
 *         description: List of available rides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rides:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           rider: { type: object }
 *                           pickup: { type: object }
 *                           dropoff: { type: object }
 *                           pricing: { type: object }
 *                           distance: { type: number }
 *                     total: { type: integer }
 *                     searchRadius: { type: number }
 */
router.get("/rides/available", authenticate, getAvailableRides);

/**
 * @swagger
 * /apimobile/driver/rides/available/poll:
 *   get:
 *     tags: [Driver Rides]
 *     summary: "[Polling] Lightweight ride availability check (poll every 5 s)"
 *     description: |
 *       Returns only `{ count, rideIds[] }` — much lighter than the full
 *       `/rides/available` endpoint. The driver app polls this every **5 seconds**
 *       and calls the full `/rides/available` only when `count > 0`.
 *
 *       ### Polling strategy
 *       ```
 *       while (driverIsOnline) {
 *         const { count, rideIds } = await GET /apimobile/driver/rides/available/poll
 *         if (count > 0) {
 *           rides = await GET /apimobile/driver/rides/available  // fetch full details
 *         }
 *         await 5 seconds
 *       }
 *       ```
 *
 *       ### WebSocket (instant, skip polling)
 *       Listen for **`new-ride-available`** — the server emits this to nearby online
 *       drivers the moment a user creates a booking. On receipt, call `/rides/available`
 *       immediately for full details.
 *
 *       ### Socket.IO connection
 *       ```js
 *       const socket = io(BASE_URL, { auth: { token: DRIVER_JWT } })
 *       socket.on('new-ride-available', (ride) => {
 *         // new ride just appeared — refresh the list
 *       })
 *       ```
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema: { type: number }
 *         example: 24.7136
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema: { type: number }
 *         example: 46.6753
 *     responses:
 *       200:
 *         description: Ride count + IDs (empty when no rides near driver)
 *         content:
 *           application/json:
 *             examples:
 *               no_rides:
 *                 summary: No rides nearby — keep polling
 *                 value:
 *                   success: true
 *                   data:
 *                     count: 0
 *                     rideIds: []
 *                     isBlocked: false
 *               rides_available:
 *                 summary: Rides found — fetch full list
 *                 value:
 *                   success: true
 *                   data:
 *                     count: 2
 *                     rideIds: [42, 43]
 *                     isBlocked: false
 *               driver_blocked:
 *                 summary: Driver is currently blocked
 *                 value:
 *                   success: true
 *                   data:
 *                     count: 0
 *                     rideIds: []
 *                     isBlocked: true
 *                     remainingMinutes: 47
 */
router.get("/rides/available/poll", authenticate, pollAvailableRides);

router.get("/rides/:id", authenticate, getRideDetail);

/** @swagger
 * /apimobile/driver/rides/respond:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Accept or reject a ride request (with optional price negotiation)
 *     description: |
 *       Single endpoint for the driver's response to a ride request. Supports three actions:
 *
 *       **1. Direct Accept (no negotiation)**
 *       Send `accept: true` without `proposedFare`. The ride is immediately assigned to the driver.
 *       ```json
 *       { "rideRequestId": 42, "accept": true }
 *       ```
 *
 *       **2. Accept with a price counter-offer**
 *       Send `accept: true` with `proposedFare`. The ride enters negotiation — the rider is notified
 *       and must accept or reject the driver's price. Use `GET /negotiation/status/:id` to poll.
 *       ```json
 *       { "rideRequestId": 42, "accept": true, "proposedFare": 85.0 }
 *       ```
 *
 *       **3. Reject**
 *       Send `accept: false`. The driver is added to the rejected list; the ride stays visible to others.
 *       ```json
 *       { "rideRequestId": 42, "accept": false, "rejectReason": "Too far" }
 *       ```
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, accept]
 *             properties:
 *               rideRequestId:
 *                 type: integer
 *                 example: 42
 *                 description: Numeric ride request ID from GET /rides/available
 *               accept:
 *                 type: boolean
 *                 example: true
 *                 description: true = accept (direct or with counter-offer) | false = reject
 *               proposedFare:
 *                 type: number
 *                 format: float
 *                 example: 85.0
 *                 description: Optional — include only when proposing a different price. Omit for direct accept.
 *               rejectReason:
 *                 type: string
 *                 example: "Too far from my location"
 *                 description: Optional reason when accept=false
 *     responses:
 *       200:
 *         description: Response depends on the action taken
 *         content:
 *           application/json:
 *             examples:
 *               directAccept:
 *                 summary: Direct accept
 *                 value:
 *                   success: true
 *                   data: { rideRequestId: 42, status: accepted }
 *                   message: Ride accepted successfully
 *               negotiating:
 *                 summary: Counter-offer sent to rider
 *                 value:
 *                   success: true
 *                   data: { rideRequestId: 42, status: negotiating, proposedFare: 85.0 }
 *                   message: Counter offer sent to rider
 *               rejected:
 *                 summary: Ride rejected
 *                 value:
 *                   success: true
 *                   data: { rideRequestId: 42, status: rejected, reason: "Too far" }
 *                   message: Ride rejected
 *       400: { description: Missing rideRequestId or invalid fare }
 *       404: { description: Ride not found }
 *       429: { description: Driver temporarily blocked due to too many rejections }
 */
router.post("/rides/respond", authenticate, respondToRide);

/** @swagger
 * /apimobile/driver/rides/update-status:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Update ride status (arrived / started)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, status]
 *             properties:
 *               rideRequestId: { type: integer }
 *               booking_id: { type: integer }
 *               status: { type: string, enum: [arrived, started] }
 *     responses:
 *       200: { description: Status updated }
 */
router.post("/rides/update-status", authenticate, updateRideStatus);

/** @swagger
 * /apimobile/driver/rides/complete:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Complete a ride (end trip, process payment + wallet)
 *     description: |
 *       Marks ride as completed, creates payment record, and credits
 *       driver wallet (for cash rides). Uses negotiated fare if accepted.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId]
 *             properties:
 *               rideRequestId: { type: string, format: uuid }
 *               tips: { type: number, example: 5.0 }
 *     responses:
 *       200: { description: Ride completed }
 */
router.post("/rides/complete", authenticate, completeRide);

/** @swagger
 * /apimobile/driver/rides/cancel:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Cancel ride from driver side
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId]
 *             properties:
 *               rideRequestId: { type: integer, description: "Numeric ride request id (same as RideRequest.id)" }
 *               booking_id: { type: integer, description: "Alias for rideRequestId (rider app naming)" }
 *               bookingId: { type: integer }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Cancelled }
 */
router.post("/rides/cancel", authenticate, cancelRide);

/** @swagger
 * /apimobile/driver/rides/rate-rider:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Rate the rider after a completed ride
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, rating]
 *             properties:
 *               rideRequestId: { type: string, format: uuid }
 *               rating: { type: number, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string }
 *     responses:
 *       200: { description: Rating saved }
 */
router.post("/rides/rate-rider", authenticate, rateRider);


// =============================================================================
//  9 — RATINGS (received by driver)
// =============================================================================

/** @swagger
 * /apimobile/driver/ratings:
 *   get:
 *     tags: [Driver Ratings]
 *     summary: Get all ratings received from riders (with average)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Ratings list with average summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *                 summary:
 *                   type: object
 *                   properties:
 *                     averageRating: { type: number, example: 4.75 }
 *                     totalRatings: { type: integer, example: 120 }
 */
router.get("/ratings", authenticate, getMyRatings);

// =============================================================================
//  10 — WALLET & EARNINGS
// =============================================================================

/** @swagger
 * /apimobile/driver/wallet:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Get wallet balance
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Wallet details }
 */
router.get("/wallet", authenticate, getWalletDetail);

/** @swagger
 * /apimobile/driver/wallet/history:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Get wallet transaction history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Transaction history }
 */
router.get("/wallet/history", authenticate, getWalletList);

/** @swagger
 * /apimobile/driver/wallet/operations:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Get recent wallet operations (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Operations list with balance }
 */
router.get("/wallet/operations", authenticate, lastUserOperations);

/** @swagger
 * /apimobile/driver/wallet/operations/filter:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Filter wallet operations by type
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [credit, debit] }
 *       - in: query
 *         name: transactionType
 *         schema: { type: string, enum: [ride_earnings, withdrawal, reward, adjustment] }
 *     responses:
 *       200: { description: Filtered operations }
 */
router.get("/wallet/operations/filter", authenticate, filterOperations);

/** @swagger
 * /apimobile/driver/wallet/earnings:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Get earnings summary (today, week, month, total)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Earnings summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance: { type: number }
 *                     currency: { type: string }
 *                     todayEarnings: { type: number }
 *                     thisWeekEarnings: { type: number }
 *                     thisMonthEarnings: { type: number }
 *                     totalEarnings: { type: number }
 *                     totalWithdrawn: { type: number }
 *                     pendingWithdrawals: { type: number }
 *                     completedRides: { type: integer }
 *                     todayRides: { type: integer }
 */
router.get("/wallet/earnings", authenticate, getEarningsSummary);

/** @swagger
 * /apimobile/driver/wallet/topup:
 *   post:
 *     tags: [Driver Wallet]
 *     summary: Charge driver wallet using card details
 *     description: |
 *       Mobile client sends only card data + amount.
 *       Do not send gateway signed fields (`SecureHash`, `MerchantId`, etc.) from the app.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, cardNumber, expiryMonth, expiryYear, cvv, cardHolderName]
 *             properties:
 *               amount: { type: number, example: 50 }
 *               cardNumber: { type: string, example: "4111111111111111" }
 *               expiryMonth: { type: string, example: "12" }
 *               expiryYear: { type: string, example: "2028" }
 *               cvv: { type: string, example: "123" }
 *               cardHolderName: { type: string, example: "Driver One" }
 *     responses:
 *       200: { description: Wallet top-up success or payment failed result }
 *       400: { description: Missing/invalid amount or card fields }
 *       503: { description: Payment service not configured }
 */
router.post("/wallet/topup", authenticate, topupWallet);

/** @swagger
 * /apimobile/driver/wallet/balance:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Get wallet balance
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current wallet balance
 */
router.get("/wallet/balance", authenticate, getWalletBalance);


// =============================================================================
//  11 — WITHDRAW REQUESTS
// =============================================================================

/** @swagger
 * /apimobile/driver/withdrawals:
 *   get:
 *     tags: [Driver Wallet]
 *     summary: Get my withdrawal requests
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of withdraw requests + wallet balance }
 */
router.get("/withdrawals", authenticate, getWithdrawRequestList);

/** @swagger
 * /apimobile/driver/withdrawals:
 *   post:
 *     tags: [Driver Wallet]
 *     summary: Submit a new withdrawal request
 *     description: Creates a pending withdrawal. Admin must approve before funds are deducted.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 500 }
 *               currency: { type: string, example: "SAR" }
 *     responses:
 *       200: { description: Request created (status=pending) }
 *       400: { description: Insufficient balance }
 */
router.post("/withdrawals", authenticate, saveWithdrawRequest);

// =============================================================================
//  12 — COMPLAINTS
// =============================================================================

/** @swagger
 * /apimobile/driver/complaints:
 *   post:
 *     tags: [شكاوى الرحلة — Driver]
 *     summary: تقديم شكوى على الراكب — File a complaint about a rider
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject: { type: string, example: "Rider was rude" }
 *               description: { type: string }
 *               rideRequestId: { type: string, format: uuid }
 *               riderId: { type: integer }
 *     responses:
 *       200: { description: Complaint saved }
 */
router.post("/complaints", authenticate, saveComplaint);

/** @swagger
 * /apimobile/driver/complaints:
 *   get:
 *     tags: [شكاوى الرحلة — Driver]
 *     summary: عرض شكاواي — List all my complaints
 *     description: Returns all complaints filed by this driver, paginated. Check `status` to see if admin resolved them.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Driver complaints list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Complaints retrieved
 *               data:
 *                 total: 1
 *                 page: 1
 *                 limit: 20
 *                 items:
 *                   - id: 2
 *                     subject: "الراكب كان وقحاً"
 *                     status: in_progress
 *                     rideRequestId: 123
 *                     createdAt: "2026-04-29T00:00:00.000Z"
 */
router.get("/complaints", authenticate, listDriverComplaints);

/** @swagger
 * /apimobile/driver/complaints/{id}:
 *   get:
 *     tags: [شكاوى الرحلة — Driver]
 *     summary: عرض تفاصيل الشكوى مع ردود الإدارة — Get complaint detail + admin replies
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Complaint detail with admin comments
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: 2
 *                 subject: "الراكب كان وقحاً"
 *                 status: in_progress
 *                 complaintComments:
 *                   - id: 1
 *                     comment: "تم مراجعة الشكوى وتحذير الراكب"
 *                     user: { id: 5, firstName: "Admin" }
 *                     createdAt: "2026-04-29T01:00:00.000Z"
 *       404: { description: Complaint not found }
 */
router.get("/complaints/:id", authenticate, getComplaintDetail);

// =============================================================================
//  13 — NEGOTIATION
// =============================================================================

/** @swagger
 * /apimobile/driver/negotiation/propose:
 *   post:
 *     tags: [Driver Negotiation]
 *     summary: Propose a fare to the rider
 *     description: |
 *       Driver sends ONE price offer on an unassigned pending ride.
 *       The system attaches this driver to the ride and notifies the rider via socket (`ride-negotiation-offer`).
 *       Use `GET /apimobile/driver/negotiation/status/{rideRequestId}` to poll for the rider's response.
 *
 *       The response includes `realPrice` — the authoritative price calculated from trip distance × the
 *       service rate the rider chose — so the driver can see what the system fair price is before proposing.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, proposedFare]
 *             properties:
 *               rideRequestId:
 *                 type: integer
 *                 example: 42
 *                 description: Numeric ride request ID from GET /apimobile/driver/rides/available
 *               proposedFare:
 *                 type: number
 *                 example: 85.0
 *                 description: The fare the driver is proposing (must be positive)
 *     responses:
 *       200:
 *         description: Negotiation offer sent to rider
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer }
 *                     proposedFare: { type: number }
 *                     realPrice: { type: number, description: "System-calculated price (km × service rate)" }
 *                     originalFare: { type: number, description: "Price the rider originally set" }
 *                     priceBreakdown: { type: object, nullable: true }
 *                     percentChange: { type: number }
 *                     negotiationStatus: { type: string, example: pending }
 *                     expiresAt: { type: string, format: date-time }
 *                 message: { type: string }
 *       400: { description: Missing fields or invalid ride status }
 *       404: { description: Ride not found }
 *       409: { description: Ride already taken by another driver }
 */
router.post("/negotiation/propose", authenticate, driverProposeNegotiation);

/** @swagger
 * /apimobile/driver/negotiation/status/{rideRequestId}:
 *   get:
 *     tags: [Driver Negotiation]
 *     summary: Check if rider accepted or rejected the driver's offer
 *     description: |
 *       **Preferred:** connect Socket.IO, authenticate, emit `join-driver-room` with your driver user id.
 *       Listen for real-time negotiation events (same payload shape as this GET response fields where applicable):
 *       - `ride-negotiation-accepted` — rider (or driver) accepted; `negotiationStatus: accepted`, `negotiatedFare`, `acceptedBy`
 *       - `ride-negotiation-rejected` — negotiation ended; `rejectedBy`, `negotiationStatus: rejected`
 *       - `ride-negotiation-counter` — other party sent a counter-offer; `proposedFare`, `expiresAt`, `proposedBy`
 *
 *       **Fallback:** poll this endpoint after `POST /negotiation/propose` or `POST /rides/respond` with a counter-offer.
 *       Returns the current `negotiationStatus`:
 *       - `pending` — rider has not responded yet
 *       - `accepted` — rider accepted; proceed to pick up the ride
 *       - `rejected` — rider rejected the offer
 *       - `expired` — 5-minute window passed without a response (driver is automatically unlinked)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: rideRequestId
 *         required: true
 *         schema: { type: integer }
 *         description: Numeric ride request ID
 *     responses:
 *       200:
 *         description: Current negotiation status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer }
 *                     negotiationStatus:
 *                       type: string
 *                       enum: [pending, accepted, rejected, expired]
 *                     originalFare: { type: number }
 *                     negotiatedFare: { type: number, nullable: true }
 *                     rideStatus: { type: string }
 *                     expiresAt: { type: string, format: date-time, nullable: true }
 *       403: { description: Not authorized (ride not assigned to this driver) }
 *       404: { description: Ride not found }
 */
router.get("/negotiation/status/:rideRequestId", authenticate, checkNegotiationStatus);

// =============================================================================
//  14 — NOTIFICATIONS
// =============================================================================

/** @swagger
 * /apimobile/driver/notifications:
 *   get:
 *     tags: [Driver Notifications]
 *     summary: Get driver notifications (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: per_page
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: unread_only
 *         schema: { type: string, enum: ["true", "false"], default: "false" }
 *     responses:
 *       200: { description: Notifications with unreadCount }
 */
router.get("/notifications", authenticate, getDriverNotifications);

/** @swagger
 * /apimobile/driver/notifications/unread-count:
 *   get:
 *     tags: [Driver Notifications]
 *     summary: عدد الإشعارات غير المقروءة — Get unread notifications count (badge)
 *     description: Use this to show a badge number on the notifications icon without fetching the full list.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data: { unreadCount: 3 }
 */
router.get("/notifications/unread-count", authenticate, getDriverUnreadCount);

/** @swagger
 * /apimobile/driver/notifications/{id}/read:
 *   put:
 *     tags: [Driver Notifications]
 *     summary: Mark a single notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Notification marked as read }
 *       404: { description: Notification not found }
 */
router.put("/notifications/:id/read", authenticate, markNotificationAsRead);

/** @swagger
 * /apimobile/driver/notifications/read-all:
 *   put:
 *     tags: [Driver Notifications]
 *     summary: Mark all notifications as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All marked as read }
 */
router.put("/notifications/read-all", authenticate, markAllNotificationsAsRead);

/** @swagger
 * /apimobile/driver/notifications/push-preference:
 *   get:
 *     tags: [Driver Notifications]
 *     summary: Get push notification status for current driver
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Push preference retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Push notification preference fetched
 *               data:
 *                 id: 75
 *                 userType: driver
 *                 pushNotificationsEnabled: true
 *   put:
 *     tags: [Driver Notifications]
 *     summary: Stop or activate push notifications for current driver
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *                 example: false
 *                 description: false = stop notifications, true = activate notifications
 *     responses:
 *       200:
 *         description: Push preference updated
 *         content:
 *           application/json:
 *             examples:
 *               stop:
 *                 value:
 *                   success: true
 *                   message: Push notifications stopped
 *                   data:
 *                     id: 75
 *                     userType: driver
 *                     pushNotificationsEnabled: false
 *               activate:
 *                 value:
 *                   success: true
 *                   message: Push notifications activated
 *                   data:
 *                     id: 75
 *                     userType: driver
 *                     pushNotificationsEnabled: true
 *       400:
 *         description: enabled must be true or false
 */
router.get("/notifications/push-preference", authenticate, getMyPushNotificationPreference);
router.put("/notifications/push-preference", authenticate, setMyPushNotificationPreference);

// =============================================================================
//  15 — STATIC PAGES
// =============================================================================

/** @swagger
 * /apimobile/driver/static/privacy-policy:
 *   get:
 *     tags: [Driver Static]
 *     summary: Get Privacy Policy
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Privacy policy text }
 */
router.get("/static/privacy-policy", authenticate, getPrivacyPolicy);

/** @swagger
 * /apimobile/driver/static/terms:
 *   get:
 *     tags: [Driver Static]
 *     summary: Get Terms and Conditions
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Terms text }
 */
router.get("/static/terms", authenticate, getTerms);

/** @swagger
 * /apimobile/driver/static/help-center:
 *   get:
 *     tags: [Driver Static]
 *     summary: Get Help Center / FAQs
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: FAQ list }
 */
router.get("/static/help-center", authenticate, getHelpCenter);

export default router;





