import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../../middleware/auth.js';

// Auth
import { login, register, sendOtp, submitOtp, resendOtp, forgotPassword, resetPassword, logout, currentUserLocation } from '../../controllers/user/mobileAuthController.js';
// Home
import { sliderOffers, getAllServices as homeGetAllServices, getLastCurrentUserBooking } from '../../controllers/user/mobileHomeController.js';
// Services
import { getAllServices, chooseService } from '../../controllers/user/mobileServiceController.js';
// Booking
import { serviceVehicleTypes, getShipmentSizes, getShipmentWeights, getPaymentMethods, createBooking } from '../../controllers/user/mobileBookingController.js';
// Offers
import { getNearDrivers, acceptDriver, cancelDriverOffer, trackDriver, getTripStatus, cancelTrip, tripEnd, rateDriver } from '../../controllers/user/mobileOfferController.js';
// Offers (extended: active ride / SOS / tip)
import { getActiveRide, triggerSosAlert, tipDriver } from '../../controllers/user/mobileOfferController.js';
// User Bookings
import { getMyBookings, filterBookings, addReview, getBookingById } from '../../controllers/user/mobileUserBookingController.js';
// Wallet
import { lastUserOperations, filterOperations } from '../../controllers/user/mobileWalletController.js';
// Profile
import { myProfile, updateProfile, deleteAccount, getUserAddresses, addAddress, deleteAddress } from '../../controllers/user/mobileProfileController.js';
// Cards (payment cards)
import { addBankCard, getBankCards, deleteBankCard } from '../../controllers/user/mobileCardController.js';
// Static (+ notification helpers)
import { getPrivacyPolicy, getHelpCenter, getTerms, getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead } from '../../controllers/user/mobileStaticController.js';
import { payskySimulateTripPayment } from '../../controllers/payskyRealPaymentsOnlyController.js';
// Negotiation
import { getSettings as getNegotiationSettings, startNegotiation, counterOffer, acceptNegotiation, rejectNegotiation, getNegotiationHistory } from '../../controllers/negotiationController.js';
// User extras (device token, change password, complaints, coupons, referral, SOS contacts)
import {
    registerDeviceToken,
    changePassword,
    createComplaint,
    listMyComplaints,
    validateCoupon,
    getMyReferral,
    listSosContacts,
    addSosContact,
    deleteSosContact,
} from '../../controllers/user/mobileUserExtrasController.js';
import {
    getMyPushNotificationPreference,
    setMyPushNotificationPreference,
} from '../../controllers/notificationPreferenceController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer for avatar upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, `avatar_${Date.now()}${path.extname(file.originalname)}`);
    },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// =============================================
// SCHEMAS
// =============================================

/**
 * @swagger
 * components:
 *   schemas:
 *     UserFull:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         firstName:
 *           type: string
 *           example: Mohamed
 *         lastName:
 *           type: string
 *           example: Ahmed
 *         email:
 *           type: string
 *           example: user@mail.com
 *         contactNumber:
 *           type: string
 *           example: "01234567890"
 *         countryCode:
 *           type: string
 *           nullable: true
 *           example: "+20"
 *         userType:
 *           type: string
 *           example: rider
 *         status:
 *           type: string
 *           example: active
 *         avatar:
 *           type: string
 *           nullable: true
 *         gender:
 *           type: string
 *           nullable: true
 *         address:
 *           type: string
 *           nullable: true
 *         latitude:
 *           type: string
 *           nullable: true
 *         longitude:
 *           type: string
 *           nullable: true
 *         isOnline:
 *           type: boolean
 *           example: false
 *         isAvailable:
 *           type: boolean
 *           example: true
 *         referralCode:
 *           type: string
 *           example: USR1234567890
 *         isVerified:
 *           type: boolean
 *           description: Must be true to login. Verify account via submit-otp after register.
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 */

// =============================================
// AUTH ROUTES  (public)
// =============================================

/**
 * @swagger
 * /apimobile/user/auth/login:
 *   post:
 *     tags: [Auth]
 *     operationId: loginWithPhone
 *     summary: Login with phone and password
 *     description: |
 *       **Phone + password only** — do not send `email` as the login identifier (use registered `contactNumber` in `phone`). Web dashboard login (`/api/auth/login`) may use email; mobile does not.
 *
 *       **Account must be verified to login.** If the account is not verified (isVerified = false):
 *       - API returns **403** (no token, no session).
 *       - Response body: `{ "success": false, "message": "Account not verified. Please verify your account first." }`
 *       - User must verify first: call **POST /auth/resend-otp** with phone to get OTP, then **POST /auth/submit-otp** with token + OTP.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, password]
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "01234567890"
 *               password:
 *                 type: string
 *                 example: "pass1234"
 *     responses:
 *       400:
 *         description: Missing phone, or email used instead of phone (mobile login is phone-only)
 *       200:
 *         description: Login successful – returns token + full user info (user.isVerified will be true)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string }
 *                     user:
 *                       $ref: '#/components/schemas/UserFull'
 *       401:
 *         description: Invalid credentials (wrong phone or password)
 *       403:
 *         description: Account not verified – cannot login. Use resend-otp (with phone) then submit-otp to verify. No token is issued.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "Account not verified. Please verify your account first." }
 */
router.post('/auth/login', login);

/**
 * @swagger
 * /apimobile/user/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user (account is unverified until OTP is submitted)
 *     description: |
 *       Creates user with isVerified = false. A random 6-digit OTP is sent via SMS.
 *       User must call POST /auth/submit-otp (with the returned token) to verify before they can login again.
 *       To request a new OTP use POST /auth/send-otp (with token) or POST /auth/resend-otp (with phone).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, password, confirmPassword]
 *             properties:
 *               name: { type: string, example: "Mohamed Ahmed" }
 *               email: { type: string, example: "user@mail.com" }
 *               phone: { type: string, example: "01234567890" }
 *               password: { type: string, example: "pass1234" }
 *               confirmPassword: { type: string, example: "pass1234" }
 *               avatar: { type: string, nullable: true, example: null }
 *     responses:
 *       201:
 *         description: Registered – token + user returned (user.isVerified = false). Verify via submit-otp to enable login.
 *       400:
 *         description: Validation error or user exists
 */
router.post('/auth/register', register);

/**
 * @swagger
 * /apimobile/user/auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     operationId: resendOtpByPhone
 *     summary: Send OTP by phone number (for unverified account – no token required)
 *     description: |
 *       **Use this when the user is not verified and needs an OTP.** No authentication required.
 *       - Send **phone number** in body; API finds the user and sends a new 6-digit OTP via SMS (expires in 5 min).
 *       - Only works if user exists and is not yet verified (isVerified = false).
 *       - Response includes **token**; use it in **POST /auth/submit-otp** with this token + otp to verify, then login.
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
 *                 description: User's phone number (as registered)
 *                 example: "01234567890"
 *     responses:
 *       200:
 *         description: OTP sent successfully; response includes token for use with submit-otp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "OTP sent successfully" }
 *                 token: { type: string, description: "JWT to use in POST /auth/submit-otp with otp body" }
 *       400:
 *         description: Account already verified or phone missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string }
 *       404:
 *         description: User not found for this phone
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: "User not found" }
 */
router.post('/auth/resend-otp', resendOtp);

/**
 * @swagger
 * /apimobile/user/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     operationId: userForgotPassword
 *     summary: Forgot password – sends OTP to phone number
 *     description: |
 *       Send the user's registered **phone** number. If found, an OTP is sent via SMS and a temporary JWT token is returned.
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
router.post('/auth/forgot-password', forgotPassword);

/**
 * @swagger
 * /apimobile/user/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     operationId: userResetPassword
 *     summary: Reset password using OTP (requires token from forgot-password)
 *     description: |
 *       After calling **forgot-password**, use the returned token in the Authorization header and provide the OTP + new password.
 *       On success the password is updated and the user can login with the new password.
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
router.post('/auth/reset-password', authenticate, resetPassword);

// =============================================
// AUTH ROUTES  (protected)
// =============================================

/**
 * @swagger
 * /apimobile/user/auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     operationId: sendOtpWithToken
 *     summary: Send OTP when logged in (for unverified account – requires token)
 *     description: |
 *       Sends a new 6-digit OTP via SMS to the **current user's phone** (from token). Use when user has token but is not verified.
 *       OTP expires in 5 minutes. No body required. For sending OTP by phone without token, use **POST /auth/resend-otp**.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP sent successfully to user's contact number
 *       400:
 *         description: Account already verified
 *       404:
 *         description: User not found
 */
router.post('/auth/send-otp', authenticate, sendOtp);

/**
 * @swagger
 * /apimobile/user/auth/submit-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and set account as verified (required before login)
 *     description: |
 *       Call this after register (using the token from register). Sets isVerified = true and clears OTP.
 *       Only after successful submit-otp can the user login with phone + password.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string, example: "123456", description: "6-digit OTP received via SMS" }
 *               token: { type: string, description: "Optional if sent in Authorization header. JWT from register or resend-otp." }
 *     responses:
 *       200:
 *         description: OTP verified – account activated (isVerified = true), can now login
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/auth/submit-otp', authenticate, submitOtp);

/**
 * @swagger
 * /apimobile/user/auth/current-location:
 *   post:
 *     tags: [Auth]
 *     summary: Update current user's location (client sends lat/lng to be stored)
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
 *               latitude:
 *                 type: number
 *                 example: 30.0444
 *               longitude:
 *                 type: number
 *                 example: 31.2357
 *     responses:
 *       200:
 *         description: Location updated and returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id: { type: integer }
 *                     latitude: { type: string }
 *                     longitude: { type: string }
 *                     lastUpdatedAt: { type: string, format: date-time }
 *       400:
 *         description: Missing latitude or longitude
 */
router.post('/auth/current-location', authenticate, currentUserLocation);

/**
 * @swagger
 * /apimobile/user/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout
 *     description: |
 *       Logs out the current user. Server sets user isOnline = false. Client must discard the token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Logged out successfully" }
 *       401:
 *         description: Unauthorized – invalid or missing token
 */
router.post('/logout', authenticate, logout);

// =============================================
// HOME SCREEN
// =============================================

/**
 * @swagger
 * /apimobile/user/home/slider-offers:
 *   get:
 *     tags: [Home]
 *     summary: Get slider offers / coupons
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of offers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       title: { type: string }
 *                       titleAr: { type: string }
 *                       image: { type: string, nullable: true, description: "Full URL to offer image" }
 *                       discountType: { type: string }
 *                       discountValue: { type: number }
 *                       description: { type: string }
 *                       code: { type: string }
 *                       startDate: { type: string, format: date-time }
 *                       endDate: { type: string, format: date-time }
 */
router.get('/home/slider-offers', authenticate, sliderOffers);

/**
 * @swagger
 * /apimobile/user/home/services:
 *   get:
 *     tags: [Home]
 *     summary: Get all active services for home screen
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of service categories with vehicle categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       nameAr: { type: string }
 *                       icon: { type: string }
 *                       slug: { type: string }
 *                       image: { type: string, nullable: true, description: "Service category image URL" }
 *                       vehicleCategories:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id: { type: integer }
 *                             name: { type: string }
 *                             nameAr: { type: string }
 *                             image: { type: string, nullable: true, description: "Full URL to vehicle category image" }
 *                             icon: { type: string }
 */
router.get('/home/services', authenticate, homeGetAllServices);

/**
 * @swagger
 * /apimobile/user/home/last-booking:
 *   get:
 *     tags: [Home]
 *     summary: Get user's bookings (paginated, newest first)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number (1-based)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Items per page (max 50)
 *     responses:
 *       200:
 *         description: Paginated bookings with driver details, vehicle images, ratings, and locations
 */
router.get('/home/last-booking', authenticate, getLastCurrentUserBooking);

// =============================================
// SERVICES SCREEN
// =============================================

/**
 * @swagger
 * /apimobile/user/services/all:
 *   get:
 *     tags: [Services]
 *     summary: Get all services (same as home)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of services with vehicle categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       nameAr: { type: string }
 *                       icon: { type: string }
 *                       slug: { type: string }
 *                       vehicleCategories:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id: { type: integer }
 *                             name: { type: string }
 *                             nameAr: { type: string }
 *                             image: { type: string, nullable: true, description: "Full URL to vehicle category image" }
 *                             icon: { type: string }
 */
router.get('/services/all', authenticate, getAllServices);

/**
 * @swagger
 * /apimobile/user/services/choose/{serviceId}:
 *   get:
 *     tags: [Services]
 *     summary: Choose a service – returns full details for Booking screen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Service details with vehicle categories and pricing rules
 *       404:
 *         description: Service not found
 */
router.get('/services/choose/:serviceId', authenticate, chooseService);

// =============================================
// BOOKING SCREEN
// =============================================

/**
 * @swagger
 * /apimobile/user/booking/vehicle-types/{serviceId}:
 *   get:
 *     tags: [Booking]
 *     summary: Get vehicle types for a specific service with pricing
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of vehicle types with pricing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       vehicle_id: { type: integer }
 *                       type: { type: string }
 *                       name: { type: string }
 *                       nameAr: { type: string }
 *                       image: { type: string, nullable: true, description: "Full URL to vehicle category image" }
 *                       icon: { type: string }
 *                       capacity: { type: integer, nullable: true }
 *                       maxLoad: { type: number, nullable: true }
 *                       price: { type: number, description: "Base fare from pricing rule" }
 *                       pricingRule:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: integer }
 *                           baseFare: { type: number }
 *                           minimumFare: { type: number }
 *                           baseDistance: { type: number }
 *                           perDistanceAfterBase: { type: number }
 *                           perMinuteDrive: { type: number }
 *                           perMinuteWait: { type: number }
 *                           cancellationFee: { type: number }
 */
router.get('/booking/vehicle-types/:serviceId', authenticate, serviceVehicleTypes);

/**
 * @swagger
 * /apimobile/user/booking/shipment-sizes:
 *   get:
 *     tags: [Booking]
 *     summary: Get shipment sizes (optional filter by vehicleCategoryId)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vehicleCategoryId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array [vehicle_id, id, name, price]
 */
router.get('/booking/shipment-sizes', authenticate, getShipmentSizes);

/**
 * @swagger
 * /apimobile/user/booking/shipment-weights:
 *   get:
 *     tags: [Booking]
 *     summary: Get shipment weights (optional filter by vehicleCategoryId)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: vehicleCategoryId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array [vehicle_id, id, name, price]
 */
router.get('/booking/shipment-weights', authenticate, getShipmentWeights);

/**
 * @swagger
 * /apimobile/user/booking/payment-methods:
 *   get:
 *     tags: [Booking]
 *     summary: Get available payment methods
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment methods retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Payment methods retrieved" }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       payment_id: { type: integer, example: 1 }
 *                       name: { type: string, example: "Cash" }
 *                       nameAr: { type: string, nullable: true, example: "كاش" }
 *                       type: { type: string, nullable: true, example: "cash" }
 */
router.get('/booking/payment-methods', authenticate, getPaymentMethods);

/**
 * Route retained for backward compatibility.
 * Runtime behavior is disabled and returns an error so fake payments cannot be created.
 */
router.post('/payments/paysky-simulate', authenticate, payskySimulateTripPayment);

/**
 * @swagger
 * /apimobile/user/booking/create:
 *   post:
 *     tags: [Booking]
 *     summary: Create a new booking
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [vehicle_id, from, to]
 *             properties:
 *               vehicle_id: { type: integer, example: 1 }
 *               shipmentSize_id: { type: integer, nullable: true }
 *               shipmentWeight_id: { type: integer, nullable: true }
 *               paymentMethod: { type: integer, example: 0, description: "0=cash, or gateway ID" }
 *               from:
 *                 type: object
 *                 properties:
 *                   lat: { type: number, example: 30.0444 }
 *                   lng: { type: number, example: 31.2357 }
 *                   address: { type: string }
 *               to:
 *                 type: object
 *                 properties:
 *                   lat: { type: number, example: 30.1 }
 *                   lng: { type: number, example: 31.3 }
 *                   address: { type: string }
 *               totalPrice: { type: number, nullable: true, description: "Override total if provided" }
 *     responses:
 *       201:
 *         description: Booking created
 *       400:
 *         description: Missing required fields
 */
router.post('/booking/create', authenticate, createBooking);

/**
 * @swagger
 * /api/payments/paysky/init:
 *   post:
 *     tags: [Booking]
 *     summary: Initialize a real PaySky card payment for an existing ride
 *     description: |
 *       Returns the signed PaySky Lightbox configuration used to start a **real**
 *       gateway payment. This endpoint does not mark the ride as paid by itself.
 *       Payment is recorded only after a valid PaySky callback / confirmation flow.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId]
 *             properties:
 *               rideRequestId:
 *                 type: integer
 *                 example: 42
 *                 description: Existing ride request ID
 *     responses:
 *       200:
 *         description: PaySky payment config generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentConfig:
 *                       type: object
 *                       properties:
 *                         mid: { type: string, example: "3709723182-wedata" }
 *                         tid: { type: string, example: "71274357" }
 *                         amountTrxn: { type: integer, example: 15000 }
 *                         merchantReference: { type: string, example: "RIDE:42" }
 *                         trxDateTime: { type: string, example: "20260415183045" }
 *                         secureHash: { type: string, example: "ABCDEF0123456789" }
 *                         currency: { type: string, example: "818" }
 *                         expiresAt: { type: string, format: date-time }
 *                     environment: { type: string, example: "development" }
 *                     payskyEnvironment: { type: string, example: "production" }
 *                     lightboxJsUrl: { type: string, example: "https://cube.paysky.io:6006/js/LightBox.js" }
 *                     callbackUrl: { type: string, example: "https://example.com/api/payments/paysky/notification" }
 *       400:
 *         description: Invalid rideRequestId, no driver assigned, or ride already paid
 *       403:
 *         description: Only the rider or admin can initiate payment for the ride
 *       404:
 *         description: Ride request not found
 *       503:
 *         description: PaySky is not configured on the server
 */

/**
 * @swagger
 * /api/payments/paysky/confirm:
 *   post:
 *     tags: [Booking]
 *     summary: Confirm a real PaySky payment callback for a ride
 *     description: |
 *       Finalizes payment only when the request contains a valid signed PaySky
 *       payload matching the ride, amount, merchant, terminal, and currency.
 *       This endpoint is part of the real gateway payment flow.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               [rideRequestId, systemReference, amount, paidThrough, secureHash, merchantId, terminalId, merchantReference, dateTimeLocalTrxn]
 *             properties:
 *               rideRequestId: { type: integer, example: 42 }
 *               systemReference: { type: string, example: "1234567890" }
 *               amount: { type: number, example: 150.0 }
 *               paidThrough: { type: string, example: "Card" }
 *               secureHash: { type: string, example: "ABCDEF0123456789" }
 *               merchantId: { type: string, example: "3709723182-wedata" }
 *               terminalId: { type: string, example: "71274357" }
 *               merchantReference: { type: string, example: "RIDE:42" }
 *               dateTimeLocalTrxn: { type: string, example: "20260415183045" }
 *               currency: { type: string, example: "818" }
 *               actionCode: { type: string, example: "00" }
 *               txnType: { type: string, example: "1" }
 *     responses:
 *       200:
 *         description: Payment confirmed successfully or already recorded
 *       400:
 *         description: Invalid ride, amount mismatch, invalid MerchantReference, or PaySky did not approve payment
 *       401:
 *         description: Invalid signature, merchant mismatch, or terminal mismatch
 *       403:
 *         description: Only the rider or admin can confirm payment for the ride
 *       404:
 *         description: Ride request not found
 */

// =============================================
// OFFERS SCREEN (Near Drivers & Trip)
// =============================================

/**
 * @swagger
 * /apimobile/user/offers/near-drivers:
 *   post:
 *     tags: [Offers]
 *     summary: Search for nearby drivers (progressive 1→5km). Returns empty with retry message if none found.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [booking_location, booking_id]
 *             properties:
 *               booking_id: { type: string, format: uuid, example: "123e4567-e89b-12d3-a456-426614174000" }
 *               booking_location:
 *                 type: object
 *                 properties:
 *                   lat: { type: number }
 *                   lng: { type: number }
 *     responses:
 *       200:
 *         description: Array of nearby drivers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       name: { type: string }
 *                       avatar: { type: string, nullable: true, description: "Full URL to driver avatar" }
 *                       rate: { type: number }
 *                       price: { type: number }
 *                       vehicleType: { type: string }
 *                       vehicleImage: { type: string, nullable: true }
 *                       currentLocation:
 *                         type: object
 *                         properties:
 *                           lat: { type: string }
 *                           lng: { type: string }
 */
router.post('/offers/near-drivers', authenticate, getNearDrivers);

/**
 * @swagger
 * /apimobile/user/offers/accept-driver:
 *   post:
 *     tags: [Offers]
 *     summary: Accept a driver for the booking
 *     description: Assigns the chosen driver to the booking, sets status to accepted, and returns trip details. Use cancel-driver-offer to remove the driver and choose another.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, booking_id]
 *             properties:
 *               driver_id: { type: integer, description: ID of the driver to accept }
 *               booking_id: { type: string, format: uuid, description: ID of the ride request/booking (UUID) }
 *     responses:
 *       200:
 *         description: Driver accepted – returns DriverInfo, vehicle, trip_code, price, from/to, tripStatus
 *       400:
 *         description: Missing driver_id or booking_id
 *       404:
 *         description: Booking not found
 */
router.post('/offers/accept-driver', authenticate, acceptDriver);

/**
 * @swagger
 * /apimobile/user/offers/cancel-driver-offer:
 *   post:
 *     tags: [Offers]
 *     summary: Cancel driver offer (remove assigned driver from booking)
 *     description: |
 *       Removes the currently accepted driver from the booking and sets status back to pending.
 *       Use this when the rider wants to choose a different driver before the trip starts.
 *       Driver is notified via Socket.IO (driver-offer-cancelled). After success, rider can call near-drivers and accept-driver again.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, booking_id]
 *             properties:
 *               driver_id: { type: integer, description: ID of the driver to remove from the booking }
 *               booking_id: { type: string, format: uuid, description: ID of the booking (UUID) }
 *     responses:
 *       200:
 *         description: Driver offer cancelled – booking is pending again
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     booking_id: { type: string, format: uuid }
 *                     status: { type: string, example: "pending" }
 *       400:
 *         description: Missing params, no driver assigned, or driver does not match booking
 *       404:
 *         description: Booking not found
 */
router.post('/offers/cancel-driver-offer', authenticate, cancelDriverOffer);

/**
 * @swagger
 * /apimobile/user/offers/track-driver:
 *   post:
 *     tags: [Offers]
 *     summary: Start tracking driver location via WebSocket. Returns driver's current location and WebSocket instructions.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, booking_id]
 *             properties:
 *               driver_id: { type: integer }
 *               booking_id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Tracking started – subscribe to ride-{bookingId} WebSocket room
 */
router.post('/offers/track-driver', authenticate, trackDriver);

/**
 * @swagger
 * /apimobile/user/offers/trip-status/{bookingId}:
 *   get:
 *     tags: [Offers]
 *     summary: Get current trip status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Trip status and location info
 */
router.get('/offers/trip-status/:bookingId', authenticate, getTripStatus);

/**
 * @swagger
 * /apimobile/user/offers/cancel-trip:
 *   post:
 *     tags: [Offers]
 *     summary: Cancel trip from user side. Notifies driver via Socket.IO.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [booking_id]
 *             properties:
 *               driver_id: { type: integer }
 *               booking_id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Trip cancelled successfully
 */
router.post('/offers/cancel-trip', authenticate, cancelTrip);

/**
 * @swagger
 * /apimobile/user/offers/trip-end:
 *   post:
 *     tags: [Offers]
 *     summary: Mark trip as ended (completed)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [booking_id]
 *             properties:
 *               driver_id: { type: integer }
 *               booking_id: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Trip ended successfully
 */
router.post('/offers/trip-end', authenticate, tripEnd);

/**
 * @swagger
 * /apimobile/user/offers/rate-driver:
 *   post:
 *     tags: [Offers]
 *     summary: Rate the driver (1–5 stars)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, booking_id, rate]
 *             properties:
 *               driver_id: { type: integer }
 *               booking_id: { type: string, format: uuid }
 *               rate: { type: number, minimum: 1, maximum: 5, example: 5 }
 *               text: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Driver rated successfully
 */
router.post('/offers/rate-driver', authenticate, rateDriver);

// =============================================
// USER BOOKING HISTORY SCREEN
// =============================================

/**
 * @swagger
 * /apimobile/user/my-bookings:
 *   get:
 *     tags: [My Bookings]
 *     summary: Get all user bookings with status (paginated)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: User bookings with status, driver, rating info
 */
router.get('/my-bookings', authenticate, getMyBookings);

/**
 * @swagger
 * /apimobile/user/my-bookings/filter:
 *   get:
 *     tags: [My Bookings]
 *     summary: Filter bookings by status (same response shape as my-bookings)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, accepted, started, arrived, completed, cancelled]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated filtered bookings with full driver/vehicle/rating details
 */
router.get('/my-bookings/filter', authenticate, filterBookings);

/**
 * @swagger
 * /apimobile/user/my-bookings/review:
 *   post:
 *     tags: [My Bookings]
 *     summary: Add a text review for a completed booking
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [book_id, text]
 *             properties:
 *               book_id: { type: string, format: uuid }
 *               text: { type: string }
 *               trip_code: { type: string }
 *     responses:
 *       200:
 *         description: Review added
 */
router.post('/my-bookings/review', authenticate, addReview);

// =============================================
// WALLET SCREEN
// =============================================

/**
 * @swagger
 * /apimobile/user/wallet/operations:
 *   get:
 *     tags: [Wallet]
 *     summary: Get last wallet operations with balance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Wallet balance and operations list
 */
router.get('/wallet/operations', authenticate, lastUserOperations);

/**
 * @swagger
 * /apimobile/user/wallet/operations/filter:
 *   get:
 *     tags: [Wallet]
 *     summary: Filter wallet operations by type or transactionType
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: transactionType
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Filtered operations
 */
router.get('/wallet/operations/filter', authenticate, filterOperations);

// =============================================
// PROFILE SCREEN
// =============================================

/**
 * @swagger
 * /apimobile/user/profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get full user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full user profile info
 */
router.get('/profile', authenticate, myProfile);

/**
 * @swagger
 * /apimobile/user/profile/update:
 *   put:
 *     tags: [Profile]
 *     summary: Update profile including avatar upload (multipart/form-data)
 *     security:
 *       - bearerAuth: []
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
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile/update', authenticate, upload.single('avatar'), updateProfile);

/**
 * @swagger
 * /apimobile/user/profile/delete:
 *   delete:
 *     tags: [Profile]
 *     summary: Delete user account (soft delete – sets status to deleted)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/profile/delete', authenticate, deleteAccount);

// =============================================
// USER ADDRESSES
// =============================================

/**
 * @swagger
 * /apimobile/user/addresses:
 *   get:
 *     tags: [Profile]
 *     summary: Get user's saved addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved addresses
 */
router.get('/addresses', authenticate, getUserAddresses);

/**
 * @swagger
 * /apimobile/user/addresses:
 *   post:
 *     tags: [Profile]
 *     summary: Add a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address]
 *             properties:
 *               title: { type: string, example: "Home" }
 *               address: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               isDefault: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Address added
 */
router.post('/addresses', authenticate, addAddress);

/**
 * @swagger
 * /apimobile/user/addresses/{id}:
 *   delete:
 *     tags: [Profile]
 *     summary: Delete a saved address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Address deleted
 */
router.delete('/addresses/:id', authenticate, deleteAddress);

// =============================================
// BANK CARDS (payment cards)
// =============================================

/**
 * @swagger
 * /apimobile/user/add-bank-card:
 *   post:
 *     tags: [Cards]
 *     summary: Add a payment card (store last 4 digits + metadata only; never send full card number)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lastFourDigits]
 *             properties:
 *               cardHolderName: { type: string, example: "John Doe" }
 *               lastFourDigits: { type: string, example: "4242", description: "Last 4 digits of the card" }
 *               brand: { type: string, example: "visa", description: "e.g. visa, mastercard" }
 *               expiryMonth: { type: integer, example: 12, minimum: 1, maximum: 12 }
 *               expiryYear: { type: integer, example: 2028 }
 *               isDefault: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Card added successfully
 *       400:
 *         description: Valid last 4 digits required
 */
router.post('/add-bank-card', authenticate, addBankCard);

/**
 * @swagger
 * /apimobile/user/bank-cards:
 *   get:
 *     tags: [Cards]
 *     summary: Get user's saved payment cards
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved cards (id, cardHolderName, lastFourDigits, brand, expiryMonth, expiryYear, isDefault)
 */
router.get('/bank-cards', authenticate, getBankCards);

/**
 * @swagger
 * /apimobile/user/bank-cards/{id}:
 *   delete:
 *     tags: [Cards]
 *     summary: Delete a saved payment card
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Card deleted
 *       404:
 *         description: Card not found
 */
router.delete('/bank-cards/:id', authenticate, deleteBankCard);

// =============================================
// STATIC PAGES & NOTIFICATIONS
// =============================================

/**
 * @swagger
 * /apimobile/user/static/privacy-policy:
 *   get:
 *     tags: [Static]
 *     summary: Get Privacy Policy page content
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Privacy policy text
 */
router.get('/static/privacy-policy', authenticate, getPrivacyPolicy);

/**
 * @swagger
 * /apimobile/user/static/help-center:
 *   get:
 *     tags: [Static]
 *     summary: Get Help Center / FAQ list
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of FAQs [question, answer]
 */
router.get('/static/help-center', authenticate, getHelpCenter);

/**
 * @swagger
 * /apimobile/user/static/terms:
 *   get:
 *     tags: [Static]
 *     summary: Get Terms and Conditions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Terms and Conditions text
 */
router.get('/static/terms', authenticate, getTerms);

/**
 * @swagger
 * /apimobile/user/notifications:
 *   get:
 *     tags: [Static]
 *     summary: Get all notifications for the user (marks unread as read) + active offers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Notifications array + active offers
 */
router.get('/notifications', authenticate, getNotifications);

// =============================================
// NEGOTIATION (ride fare negotiation)
// =============================================

/**
 * @swagger
 * /apimobile/user/negotiation/settings:
 *   get:
 *     tags: [Negotiation]
 *     summary: Get negotiation feature settings
 *     description: |
 *       Returns whether negotiation is enabled, the max allowed percentage,
 *       max rounds, and timeout in seconds. No auth required — mobile apps
 *       call this to decide whether to show negotiation UI.
 *     security: []
 *     responses:
 *       200:
 *         description: Negotiation settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     enabled: { type: boolean, example: false }
 *                     maxPercent: { type: number, example: 20 }
 *                     maxRounds: { type: integer, example: 3 }
 *                     timeoutSeconds: { type: integer, example: 90 }
 */
router.get('/negotiation/settings', getNegotiationSettings);

/**
 * @swagger
 * /apimobile/user/negotiation/start:
 *   post:
 *     tags: [Negotiation]
 *     summary: Start negotiation — rider proposes a new fare
 *     description: |
 *       Rider proposes a different fare (discount or boost within ±maxPercent of baseFare).
 *       Creates first negotiation round. Returns expiration time.
 *       **Requires negotiation to be enabled in settings.**
 *     security:
 *       - bearerAuth: []
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
 *                 description: Ride request ID
 *               proposedFare:
 *                 type: number
 *                 example: 85.0
 *                 description: "Proposed fare (must be within ±maxPercent of baseFare)"
 *     responses:
 *       200:
 *         description: Negotiation started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer, example: 42 }
 *                     baseFare: { type: number }
 *                     proposedFare: { type: number }
 *                     percentChange: { type: number, example: -15 }
 *                     negotiationStatus: { type: string, example: "pending" }
 *                     expiresAt: { type: string, format: date-time }
 *                     round: { type: integer, example: 1 }
 *                     maxRounds: { type: integer, example: 3 }
 *       400:
 *         description: Invalid params, fare out of range, or ride not eligible
 *       403:
 *         description: Negotiation disabled or not the rider
 *       404:
 *         description: Ride request not found
 */
router.post('/negotiation/start', authenticate, startNegotiation);

/**
 * @swagger
 * /apimobile/user/negotiation/counter:
 *   post:
 *     tags: [Negotiation]
 *     summary: Counter-offer — rider or driver proposes a different fare
 *     description: |
 *       Either party can submit a counter-offer if it's their turn.
 *       The fare must still be within ±maxPercent of the original baseFare.
 *       Round count increases; if maxRounds is reached, no more counters are allowed.
 *     security:
 *       - bearerAuth: []
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
 *               proposedFare:
 *                 type: number
 *                 example: 90.0
 *     responses:
 *       200:
 *         description: Counter-offer submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer, example: 42 }
 *                     baseFare: { type: number }
 *                     proposedFare: { type: number }
 *                     percentChange: { type: number }
 *                     negotiationStatus: { type: string, example: "counter_offered" }
 *                     expiresAt: { type: string, format: date-time }
 *                     round: { type: integer }
 *                     maxRounds: { type: integer }
 *       400:
 *         description: Not your turn, max rounds reached, expired, or fare out of range
 *       403:
 *         description: Negotiation disabled or not authorized
 *       404:
 *         description: Ride request not found
 */
router.post('/negotiation/counter', authenticate, counterOffer);

/**
 * @swagger
 * /apimobile/user/negotiation/accept:
 *   post:
 *     tags: [Negotiation]
 *     summary: Accept the current negotiated fare
 *     description: |
 *       Either rider or driver can accept the last proposed fare.
 *       Sets negotiationStatus = "accepted" and locks the negotiatedFare.
 *       Commission will be calculated on this final fare at ride completion.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId]
 *             properties:
 *               rideRequestId:
 *                 type: integer
 *                 example: 42
 *     responses:
 *       200:
 *         description: Negotiation accepted — fare locked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer, example: 42 }
 *                     baseFare: { type: number }
 *                     negotiatedFare: { type: number }
 *                     percentChange: { type: number }
 *                     negotiationStatus: { type: string, example: "accepted" }
 *       400:
 *         description: No active negotiation to accept or expired
 *       403:
 *         description: Not authorized for this ride
 *       404:
 *         description: Ride request not found
 */
router.post('/negotiation/accept', authenticate, acceptNegotiation);

/**
 * @swagger
 * /apimobile/user/negotiation/reject:
 *   post:
 *     tags: [Negotiation]
 *     summary: Reject negotiation — revert to base fare
 *     description: |
 *       Either party can reject the negotiation. The ride reverts to the
 *       original totalAmount (baseFare). negotiatedFare is cleared.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId]
 *             properties:
 *               rideRequestId:
 *                 type: integer
 *                 example: 42
 *     responses:
 *       200:
 *         description: Negotiation rejected — baseFare restored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer, example: 42 }
 *                     baseFare: { type: number }
 *                     negotiatedFare: { type: number, nullable: true, example: null }
 *                     negotiationStatus: { type: string, example: "rejected" }
 *       400:
 *         description: No active negotiation to reject
 *       403:
 *         description: Not authorized for this ride
 *       404:
 *         description: Ride request not found
 */
router.post('/negotiation/reject', authenticate, rejectNegotiation);

/**
 * @swagger
 * /apimobile/user/negotiation/history/{rideRequestId}:
 *   get:
 *     tags: [Negotiation]
 *     summary: Get full negotiation history for a ride
 *     description: |
 *       Returns the ride's negotiation state (baseFare, negotiatedFare, status, rounds)
 *       plus all negotiation history records (who proposed, what fare, when).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideRequestId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 42
 *     responses:
 *       200:
 *         description: Negotiation history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     ride:
 *                       type: object
 *                       properties:
 *                         id: { type: integer, example: 42 }
 *                         baseFare: { type: number }
 *                         negotiatedFare: { type: number, nullable: true }
 *                         negotiationStatus: { type: string }
 *                         negotiationRounds: { type: integer }
 *                         maxPercent: { type: number, nullable: true }
 *                         expiresAt: { type: string, format: date-time, nullable: true }
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           proposedBy: { type: string, example: "rider" }
 *                           proposedFare: { type: number }
 *                           percentChange: { type: number }
 *                           action: { type: string, example: "propose" }
 *                           round: { type: integer }
 *                           createdAt: { type: string, format: date-time }
 *       403:
 *         description: Not authorized to view this ride's negotiation
 *       404:
 *         description: Ride request not found
 */
router.get('/negotiation/history/:rideRequestId', authenticate, getNegotiationHistory);

// =============================================
// DEVICE / PUSH TOKEN
// =============================================

/**
 * @swagger
 * /apimobile/user/device-token:
 *   post:
 *     tags: [Profile]
 *     summary: Register / update the user's push notification token
 *     description: |
 *       Stores the FCM token (and/or OneSignal playerId) for the authenticated user so the
 *       backend can send push notifications. Safe to call on every app start.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fcmToken:   { type: string, example: "eY1aVb...:APA91bH" }
 *               playerId:   { type: string, example: "abc123-def-xyz" }
 *               appVersion: { type: string, example: "1.4.2" }
 *               platform:   { type: string, example: "android" }
 *     responses:
 *       200:
 *         description: Device token registered
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Device token registered
 *               data:
 *                 id: 42
 *                 fcmToken: "eY1aVb...:APA91bH"
 *                 playerId: "abc123-def-xyz"
 *                 appVersion: "1.4.2"
 *                 updatedAt: "2026-04-18T10:05:12.000Z"
 *                 platform: "android"
 *       400:
 *         description: fcmToken or playerId is required
 */
router.post('/device-token', authenticate, registerDeviceToken);

/**
 * @swagger
 * /apimobile/user/notifications/push-preference:
 *   get:
 *     tags: [Profile]
 *     summary: Get push notification status for current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Push preference retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Push notification preference fetched
 *               data:
 *                 id: 42
 *                 userType: rider
 *                 pushNotificationsEnabled: true
 *   put:
 *     tags: [Profile]
 *     summary: Stop or activate push notifications for current user
 *     security:
 *       - bearerAuth: []
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
 *                     id: 42
 *                     userType: rider
 *                     pushNotificationsEnabled: false
 *               activate:
 *                 value:
 *                   success: true
 *                   message: Push notifications activated
 *                   data:
 *                     id: 42
 *                     userType: rider
 *                     pushNotificationsEnabled: true
 *       400:
 *         description: enabled must be true or false
 */
router.get('/notifications/push-preference', authenticate, getMyPushNotificationPreference);
router.put('/notifications/push-preference', authenticate, setMyPushNotificationPreference);

// =============================================
// AUTH - CHANGE PASSWORD (logged in)
// =============================================

/**
 * @swagger
 * /apimobile/user/auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password while logged in
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, example: "OldPass@123" }
 *               newPassword:     { type: string, example: "NewPass@123" }
 *     responses:
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             example: { success: true, message: "Password changed successfully", data: { changed: true } }
 *       400: { description: Validation error }
 *       401: { description: Current password is incorrect }
 */
router.post('/auth/change-password', authenticate, changePassword);

// =============================================
// NOTIFICATIONS - READ / UNREAD COUNT
// =============================================

/**
 * @swagger
 * /apimobile/user/notifications/unread-count:
 *   get:
 *     tags: [Static]
 *     summary: Get unread notifications count (for badge)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             example: { success: true, message: "Unread notifications count retrieved", data: { unreadCount: 3 } }
 */
router.get('/notifications/unread-count', authenticate, getUnreadNotificationCount);

/**
 * @swagger
 * /apimobile/user/notifications/read-all:
 *   post:
 *     tags: [Static]
 *     summary: Mark all notifications as read
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated count
 *         content:
 *           application/json:
 *             example: { success: true, message: "All notifications marked as read", data: { updated: 7 } }
 */
router.post('/notifications/read-all', authenticate, markAllNotificationsRead);

/**
 * @swagger
 * /apimobile/user/notifications/{id}/read:
 *   post:
 *     tags: [Static]
 *     summary: Mark a single notification as read
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Marked
 *         content:
 *           application/json:
 *             example: { success: true, message: "Notification marked as read", data: { id: 12, isRead: true } }
 *       404: { description: Notification not found }
 */
router.post('/notifications/:id/read', authenticate, markNotificationRead);

// =============================================
// MY BOOKINGS - SINGLE DETAILS
// =============================================

/**
 * @swagger
 * /apimobile/user/my-bookings/{id}:
 *   get:
 *     tags: [My Bookings]
 *     summary: Get a single booking (ride request) details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Booking retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Booking retrieved
 *               data:
 *                 id: 101
 *                 status: "completed"
 *                 totalAmount: 55.5
 *                 subtotal: 50
 *                 baseFare: 10
 *                 minimumFare: 10
 *                 perDistance: 2
 *                 perMinuteDrive: 1
 *                 distance: 12.3
 *                 duration: 18
 *                 couponDiscount: 0
 *                 tips: 5
 *                 paymentType: "cash"
 *                 startAddress: "Cairo"
 *                 endAddress: "Giza"
 *                 otp: "1234"
 *                 driver:
 *                   id: 22
 *                   firstName: "Ali"
 *                   lastName: "Hassan"
 *                   avatar: "http://host/uploads/a.png"
 *                   contactNumber: "01000000000"
 *                 shipment:
 *                   shipmentSize_id: 1
 *                   shipmentWeight_id: 1
 *                   vehicleCategoryName: "Sedan"
 *                   serviceCategoryName: "Ride"
 *                 createdAt: "2026-04-18T10:00:00.000Z"
 *       404: { description: Booking not found }
 */
router.get('/my-bookings/:id', authenticate, getBookingById);

// =============================================
// OFFERS - ACTIVE RIDE / SOS / TIP
// =============================================

/**
 * @swagger
 * /apimobile/user/offers/active-ride:
 *   get:
 *     tags: [Offers]
 *     summary: Get the rider's currently active (ongoing) ride
 *     description: Returns `null` in `data` when there's no active ride.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active ride or null
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Active ride retrieved
 *               data:
 *                 id: 202
 *                 status: "in_progress"
 *                 totalAmount: 60
 *                 paymentType: "cash"
 *                 startAddress: "Cairo"
 *                 endAddress: "Giza"
 *                 otp: "4321"
 *                 driver:
 *                   id: 22
 *                   firstName: "Ali"
 *                   lastName: "Hassan"
 *                   avatar: "http://host/uploads/a.png"
 *                   contactNumber: "01000000000"
 *                   latitude: "30.0"
 *                   longitude: "31.0"
 *                 createdAt: "2026-04-18T10:00:00.000Z"
 */
router.get('/offers/active-ride', authenticate, getActiveRide);

/**
 * @swagger
 * /apimobile/user/offers/sos:
 *   post:
 *     tags: [Offers]
 *     summary: Trigger an SOS alert during a ride
 *     description: |
 *       Creates an admin-notifiable SOS record and broadcasts a `sos:alert` event on the
 *       ride room and directly to the driver. Latitude/longitude/note are optional.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId]
 *             properties:
 *               rideRequestId: { type: integer, example: 202 }
 *               latitude:      { type: number, example: 30.0444 }
 *               longitude:     { type: number, example: 31.2357 }
 *               note:          { type: string, example: "Driver is not following the route" }
 *     responses:
 *       201: { description: SOS alert sent }
 *       400: { description: Validation error }
 *       404: { description: Ride not found or not yours }
 */
router.post('/offers/sos', authenticate, triggerSosAlert);

/**
 * @swagger
 * /apimobile/user/offers/tip:
 *   post:
 *     tags: [Offers]
 *     summary: Add a tip to the driver for a ride
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rideRequestId, amount]
 *             properties:
 *               rideRequestId: { type: integer, example: 202 }
 *               amount:        { type: number, example: 5 }
 *     responses:
 *       201:
 *         description: Tip added
 *         content:
 *           application/json:
 *             example: { success: true, message: "Tip added successfully", data: { id: 202, tips: 5, totalAmount: 65, status: "completed" } }
 *       400: { description: Validation error }
 *       404: { description: Ride not found or not yours }
 */
router.post('/offers/tip', authenticate, tipDriver);

// =============================================
// COMPLAINTS (user side)
// =============================================

/**
 * @swagger
 * /apimobile/user/complaints:
 *   post:
 *     tags: [Complaints]
 *     summary: File a complaint
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject:       { type: string, example: "Driver was rude" }
 *               description:   { type: string, example: "The driver yelled at me..." }
 *               rideRequestId: { type: integer, example: 202 }
 *               driverId:      { type: integer, example: 22 }
 *     responses:
 *       201: { description: Complaint submitted }
 *       400: { description: Validation error }
 *       404: { description: Ride not found or not yours }
 *   get:
 *     tags: [Complaints]
 *     summary: List my complaints
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Complaints list
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
 *                   - id: 1
 *                     subject: "Driver was rude"
 *                     description: "The driver yelled at me..."
 *                     status: "pending"
 *                     rideRequestId: 202
 *                     driverId: 22
 *                     createdAt: "2026-04-18T10:10:00.000Z"
 *                     updatedAt: "2026-04-18T10:10:00.000Z"
 */
router.post('/complaints', authenticate, createComplaint);
router.get('/complaints', authenticate, listMyComplaints);

// =============================================
// COUPONS - VALIDATE
// =============================================

/**
 * @swagger
 * /apimobile/user/coupons/validate:
 *   post:
 *     tags: [Booking]
 *     summary: Validate (and preview discount for) a coupon code
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code:   { type: string, example: "E2E10" }
 *               amount: { type: number, example: 100, description: "Optional order amount for discount calculation" }
 *     responses:
 *       200:
 *         description: Coupon valid
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Coupon valid
 *               data:
 *                 coupon:
 *                   id: 1
 *                   code: "E2E10"
 *                   title: "10% off"
 *                   titleAr: "خصم 10%"
 *                   discountType: "percentage"
 *                   discount: 10
 *                   minimumAmount: 0
 *                   maximumDiscount: 50
 *                   endDate: null
 *                 orderAmount: 100
 *                 discountValue: 10
 *                 finalAmount: 90
 *       404: { description: Invalid or expired coupon }
 */
router.post('/coupons/validate', authenticate, validateCoupon);

// =============================================
// REFERRAL
// =============================================

/**
 * @swagger
 * /apimobile/user/referral:
 *   get:
 *     tags: [Profile]
 *     summary: Get my referral code and stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral info
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Referral info retrieved
 *               data:
 *                 referralCode: "R42L9QZ1"
 *                 partnerReferralCode: null
 *                 invitedCount: 3
 *                 shareMessage: "Join me on OfferGo! Use my code R42L9QZ1 to sign up."
 */
router.get('/referral', authenticate, getMyReferral);

// =============================================
// SOS CONTACTS (saved emergency contacts)
// =============================================

/**
 * @swagger
 * /apimobile/user/sos-contacts:
 *   get:
 *     tags: [Profile]
 *     summary: List my SOS / emergency contacts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SOS contacts retrieved
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: SOS contacts retrieved
 *               data:
 *                 - id: 1
 *                   name: "Mom"
 *                   nameAr: "أمي"
 *                   contactNumber: "01000000000"
 *                   createdAt: "2026-04-18T10:00:00.000Z"
 *   post:
 *     tags: [Profile]
 *     summary: Add a new SOS / emergency contact
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, contactNumber]
 *             properties:
 *               name:          { type: string, example: "Mom" }
 *               nameAr:        { type: string, example: "أمي" }
 *               contactNumber: { type: string, example: "01000000000" }
 *     responses:
 *       201: { description: SOS contact added }
 *       400: { description: Validation error }
 */
router.get('/sos-contacts', authenticate, listSosContacts);
router.post('/sos-contacts', authenticate, addSosContact);

/**
 * @swagger
 * /apimobile/user/sos-contacts/{id}:
 *   delete:
 *     tags: [Profile]
 *     summary: Delete an SOS / emergency contact
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: SOS contact not found }
 */
router.delete('/sos-contacts/:id', authenticate, deleteSosContact);

export default router;
