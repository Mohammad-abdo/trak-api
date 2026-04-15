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
    updateDriverStatus,
    getRegistrationStatus,
    getMyStatus,
    goOnlineOffline,
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
    applyBid,
    updateLocation,
    getAvailableRides,
} from "../../controllers/driver/mobileRideController.js";

// ─── Wallet ──────────────────────────────────────────────────────────────────
import { getWalletDetail, getWalletList } from "../../controllers/wallet/balanceAndHistory.js";
import { lastUserOperations, filterOperations } from "../../controllers/user/mobileWalletController.js";

// ─── Withdraw requests ───────────────────────────────────────────────────────
import { getWithdrawRequestList, saveWithdrawRequest } from "../../controllers/withdrawRequestController.js";

// ─── Complaints ──────────────────────────────────────────────────────────────
import { saveComplaint, getComplaintDetail } from "../../controllers/complaintController.js";

// ─── Notifications ───────────────────────────────────────────────────────────
import { getDriverNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../../controllers/driver/mobileNotificationController.js";

// ─── Negotiation ─────────────────────────────────────────────────────────────
import { getSettings as getNegotiationSettings, counterOffer, acceptNegotiation, rejectNegotiation, getNegotiationHistory } from "../../controllers/negotiationController.js";

// ─── Static pages ────────────────────────────────────────────────────────────
import { getPrivacyPolicy, getHelpCenter, getTerms } from "../../controllers/user/mobileStaticController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ── Multer ───────────────────────────────────────────────────────────────────
const driverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.fieldname === "documents" || file.fieldname === "document"
            ? path.join(__dirname, "../../uploads/driver-documents")
            : path.join(__dirname, "../../uploads/drivers");
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const prefix = file.fieldname === "documents" || file.fieldname === "document" ? "doc" : file.fieldname;
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
const docUpload = upload.fields([{ name: "files", maxCount: 20 }]);

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
 *       200: { description: List of document types with isRequired flag }
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
 * /apimobile/driver/profile/status:
 *   get:
 *     tags: [Driver Profile]
 *     summary: Check registration status + missing documents
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Status with canDrive flag }
 */
router.get("/profile/status", authenticate, getRegistrationStatus);

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
 *       200: { description: Documents with verification status }
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
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 message:
 *                   type: string
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
 *               currentHeading: { type: number }
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
router.get("/rides/:id", authenticate, getRideDetail);

/** @swagger
 * /apimobile/driver/rides/respond:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Accept, reject, or negotiate ride request price
 *     description: |
 *       Driver can accept ride directly, reject with reason, or propose different fare.
 *       If proposing different fare, creates negotiation record and notifies rider.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, accept]
 *             properties:
 *               rideRequestId: { type: string, format: uuid, example: "123e4567-e89b-12d3-a456-426614174000" }
 *               accept: { type: boolean, example: true, description: "Whether to accept the ride" }
 *               proposedFare: { type: number, format: float, example: 25.50, description: "Optional: proposed fare if different from original" }
 *               rejectReason: { type: string, example: "Too far from my location", description: "Required if accept=false: reason for rejection" }
 *     responses:
 *       200:
 *         description: Response based on action taken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer }
 *                     status: { type: string, enum: [accepted, rejected, negotiating] }
 *                     proposedFare: { type: number, format: float }
 *                     reason: { type: string }
 *                 message: { type: string }
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
 *               rideRequestId: { type: string, format: uuid }
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
 *               rideRequestId: { type: string, format: uuid }
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

/** @swagger
 * /apimobile/driver/rides/apply-bid:
 *   post:
 *     tags: [Driver Rides]
 *     summary: Apply bid on a ride request
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, bidAmount]
 *             properties:
 *               rideRequestId: { type: string, format: uuid }
 *               bidAmount: { type: number, example: 85.0 }
 *     responses:
 *       200: { description: Bid applied }
 */
router.post("/rides/apply-bid", authenticate, applyBid);

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
 *     tags: [Driver Complaints]
 *     summary: File a complaint about a ride or rider
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
 * /apimobile/driver/complaints/{id}:
 *   get:
 *     tags: [Driver Complaints]
 *     summary: Get complaint detail with comments
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Complaint detail }
 */
router.get("/complaints/:id", authenticate, getComplaintDetail);

// =============================================================================
//  13 — NEGOTIATION
// =============================================================================

/** @swagger
 * /apimobile/driver/negotiation/settings:
 *   get:
 *     tags: [Driver Negotiation]
 *     summary: Get negotiation feature settings
 *     security: []
 *     responses:
 *       200: { description: Settings (enabled, maxPercent, maxRounds, timeout) }
 */
router.get("/negotiation/settings", getNegotiationSettings);

/** @swagger
 * /apimobile/driver/negotiation/counter:
 *   post:
 *     tags: [Driver Negotiation]
 *     summary: Counter-offer on a ride fare
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, proposedFare]
 *             properties:
 *               rideRequestId: { type: string, format: uuid }
 *               proposedFare: { type: number, example: 95.0 }
 *     responses:
 *       200: { description: Counter-offer submitted }
 */
router.post("/negotiation/counter", authenticate, counterOffer);

/** @swagger
 * /apimobile/driver/negotiation/accept:
 *   post:
 *     tags: [Driver Negotiation]
 *     summary: Accept the negotiated fare
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
 *     responses:
 *       200: { description: Fare accepted and locked }
 */
router.post("/negotiation/accept", authenticate, acceptNegotiation);

/** @swagger
 * /apimobile/driver/negotiation/reject:
 *   post:
 *     tags: [Driver Negotiation]
 *     summary: Reject negotiation — revert to base fare
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
 *     responses:
 *       200: { description: Negotiation rejected }
 */
router.post("/negotiation/reject", authenticate, rejectNegotiation);

/** @swagger
 * /apimobile/driver/negotiation/history/{rideRequestId}:
 *   get:
 *     tags: [Driver Negotiation]
 *     summary: Get negotiation history for a ride
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: rideRequestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: Negotiation history }
 */
router.get("/negotiation/history/:rideRequestId", authenticate, getNegotiationHistory);

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
 * /apimobile/driver/notifications/{id}/read:
 *   put:
 *     tags: [Driver Notifications]
 *     summary: Mark a notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Marked as read }
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
