import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../../middleware/auth.js';

// Auth
import { login, register, sendOtp, submitOtp, resendOtp, logout, currentUserLocation } from '../../controllers/user/mobileAuthController.js';
// Home
import { sliderOffers, getAllServices as homeGetAllServices, getLastCurrentUserBooking } from '../../controllers/user/mobileHomeController.js';
// Services
import { getAllServices, chooseService } from '../../controllers/user/mobileServiceController.js';
// Booking
import { serviceVehicleTypes, getShipmentSizes, getShipmentWeights, getPaymentMethods, createBooking } from '../../controllers/user/mobileBookingController.js';
// Offers
import { getNearDrivers, acceptDriver, cancelDriverOffer, trackDriver, getTripStatus, cancelTrip, tripEnd, rateDriver } from '../../controllers/user/mobileOfferController.js';
// User Bookings
import { getMyBookings, filterBookings, addReview } from '../../controllers/user/mobileUserBookingController.js';
// Wallet
import { lastUserOperations, filterOperations } from '../../controllers/user/mobileWalletController.js';
// Profile
import { myProfile, updateProfile, deleteAccount, getUserAddresses, addAddress, deleteAddress } from '../../controllers/user/mobileProfileController.js';
// Cards (payment cards)
import { addBankCard, getBankCards, deleteBankCard } from '../../controllers/user/mobileCardController.js';
// Static
import { getPrivacyPolicy, getHelpCenter, getTerms, getNotifications } from '../../controllers/user/mobileStaticController.js';

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
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

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
 *         description: Array of offers [id, title, image, discountType, discountValue, description, startDate, endDate, vehicleCategories]
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
 *         description: Array of service categories with vehicle categories [id, name, image]
 */
router.get('/home/services', authenticate, homeGetAllServices);

/**
 * @swagger
 * /apimobile/user/home/last-booking:
 *   get:
 *     tags: [Home]
 *     summary: Get user's last active (pending/accepted/started) booking
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last booking info with driver details and locations, or null if none
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
 *         description: Array [id, name, image]
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
 *         description: Array [vehicle_id, type, name, image, price]
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
 *         description: Array [payment_id, name]
 */
router.get('/booking/payment-methods', authenticate, getPaymentMethods);

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
 *               booking_id: { type: integer, example: 1 }
 *               booking_location:
 *                 type: object
 *                 properties:
 *                   lat: { type: number }
 *                   lng: { type: number }
 *     responses:
 *       200:
 *         description: Array of nearby drivers [id, name, rate, price, vehicleType, vehicleImage]
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
 *               booking_id: { type: integer, description: ID of the ride request/booking }
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
 *               booking_id: { type: integer, description: ID of the booking }
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
 *                     booking_id: { type: integer }
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
 *               booking_id: { type: integer }
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
 *           type: integer
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
 *               booking_id: { type: integer }
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
 *               booking_id: { type: integer }
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
 *               booking_id: { type: integer }
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
 *     summary: Filter bookings by status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pending, accepted, started, arrived, completed, cancelled]
 *     responses:
 *       200:
 *         description: Filtered bookings array
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
 *               book_id: { type: integer }
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

export default router;
