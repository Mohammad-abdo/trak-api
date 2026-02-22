import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate } from '../../middleware/auth.js';

// Auth
import { login, register, sendOtp, submitOtp, currentUserLocation } from '../../controllers/user/mobileAuthController.js';
// Home
import { sliderOffers, getAllServices as homeGetAllServices, getLastCurrentUserBooking } from '../../controllers/user/mobileHomeController.js';
// Services
import { getAllServices, chooseService } from '../../controllers/user/mobileServiceController.js';
// Booking
import { serviceVehicleTypes, getShipmentSizes, getShipmentWeights, getPaymentMethods, createBooking } from '../../controllers/user/mobileBookingController.js';
// Offers
import { getNearDrivers, acceptDriver, trackDriver, getTripStatus, cancelTrip, tripEnd, rateDriver } from '../../controllers/user/mobileOfferController.js';
// User Bookings
import { getMyBookings, filterBookings, addReview } from '../../controllers/user/mobileUserBookingController.js';
// Wallet
import { lastUserOperations, filterOperations } from '../../controllers/user/mobileWalletController.js';
// Profile
import { myProfile, updateProfile, deleteAccount, getUserAddresses, addAddress, deleteAddress } from '../../controllers/user/mobileProfileController.js';
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
// AUTH ROUTES  (public)
// =============================================

/**
 * @swagger
 * /apimobile/user/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with phone and password
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
 *         description: Login successful – returns token + full user info
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
 *                     user: { $ref: '#/components/schemas/UserFull' }
 *       401:
 *         description: Invalid credentials
 */
router.post('/auth/login', login);

/**
 * @swagger
 * /apimobile/user/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user. After success an OTP is auto-generated (123456).
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
 *         description: Registered successfully – returns token + user info
 *       400:
 *         description: Validation error or user exists
 */
router.post('/auth/register', register);

// =============================================
// AUTH ROUTES  (protected)
// =============================================

/**
 * @swagger
 * /apimobile/user/auth/send-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Send OTP to user (currently fixed at 123456)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
router.post('/auth/send-otp', authenticate, sendOtp);

/**
 * @swagger
 * /apimobile/user/auth/submit-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and activate account. Returns token + full user info.
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
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: OTP verified – account activated
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/auth/submit-otp', authenticate, submitOtp);

/**
 * @swagger
 * /apimobile/user/auth/current-location:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user's stored location (lat/lng)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     latitude: { type: string }
 *                     longitude: { type: string }
 */
router.get('/auth/current-location', authenticate, currentUserLocation);

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
 *         description: Driver accepted – returns DriverInfo, vehicle, trip_code, price, from/to, tripStatus
 */
router.post('/offers/accept-driver', authenticate, acceptDriver);

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
