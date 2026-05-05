import express from 'express';
import * as ctrl from '../controllers/dedicatedBookingController.js';
import * as pricingCtrl from '../controllers/dedicatedBookingPricingController.js';
import { dedicatedBookingErrorHandler } from '../middleware/dedicatedBookingErrorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DedicatedBooking:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 12
 *         userId:
 *           type: integer
 *           example: 1
 *         driverId:
 *           type: integer
 *           nullable: true
 *           example: 7
 *         vehicleCategoryId:
 *           type: integer
 *           example: 2
 *         pickupAddress:
 *           type: string
 *           example: Cairo Airport Terminal 3
 *         pickupLat:
 *           type: number
 *           format: double
 *           example: 30.1119
 *         pickupLng:
 *           type: number
 *           format: double
 *           example: 31.4139
 *         dropoffAddress:
 *           type: string
 *           example: Nile Ritz-Carlton, Cairo
 *         dropoffLat:
 *           type: number
 *           format: double
 *           example: 30.0459
 *         dropoffLng:
 *           type: number
 *           format: double
 *           example: 31.2326
 *         bookingDate:
 *           type: string
 *           format: date-time
 *           example: 2026-05-10T00:00:00.000Z
 *         startTime:
 *           type: string
 *           format: date-time
 *           example: 2026-05-10T09:00:00.000Z
 *         durationHours:
 *           type: integer
 *           example: 6
 *         baseFare:
 *           type: number
 *           example: 100
 *         pricePerHour:
 *           type: number
 *           example: 75
 *         totalPrice:
 *           type: number
 *           example: 550
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, DRIVER_ASSIGNED, ON_THE_WAY, ACTIVE, COMPLETED, CANCELLED, EXPIRED]
 *           example: PENDING
 *         paymentStatus:
 *           type: string
 *           enum: [UNPAID, PREAUTHORIZED, CAPTURED, FAILED, REFUNDED]
 *           example: PREAUTHORIZED
 *         notes:
 *           type: string
 *           nullable: true
 *           example: Please wait near gate 4.
 *         clientSecret:
 *           type: string
 *           nullable: true
 *           description: Returned on create when Stripe payment intent is created.
 *     DedicatedBookingCreateRequest:
 *       type: object
 *       required:
 *         - userId
 *         - vehicleCategoryId
 *         - pickupAddress
 *         - pickupLat
 *         - pickupLng
 *         - dropoffAddress
 *         - dropoffLat
 *         - dropoffLng
 *         - bookingDate
 *         - startTime
 *         - durationHours
 *         - baseFare
 *         - pricePerHour
 *       properties:
 *         userId:
 *           type: integer
 *           example: 1
 *         vehicleCategoryId:
 *           type: integer
 *           example: 2
 *         pickupAddress:
 *           type: string
 *           example: Cairo Airport Terminal 3
 *         pickupLat:
 *           type: number
 *           example: 30.1119
 *         pickupLng:
 *           type: number
 *           example: 31.4139
 *         dropoffAddress:
 *           type: string
 *           example: Nile Ritz-Carlton, Cairo
 *         dropoffLat:
 *           type: number
 *           example: 30.0459
 *         dropoffLng:
 *           type: number
 *           example: 31.2326
 *         bookingDate:
 *           type: string
 *           description: Must be the same calendar date as startTime.
 *           example: 2026-05-10
 *         startTime:
 *           type: string
 *           format: date-time
 *           example: 2026-05-10T09:00:00.000Z
 *         durationHours:
 *           type: integer
 *           minimum: 1
 *           example: 6
 *         baseFare:
 *           type: number
 *           example: 100
 *         pricePerHour:
 *           type: number
 *           example: 75
 *         notes:
 *           type: string
 *           example: Please wait near gate 4.
 *         promotionCode:
 *           type: string
 *           example: VIP20
 *     DedicatedBookingPricing:
 *       type: object
 *       properties:
 *         pricePerKm:
 *           type: number
 *           example: 0
 *         pricePerDay:
 *           type: number
 *           example: 0
 *         pricePerTrip:
 *           type: number
 *           example: 0
 *         baseFare:
 *           type: number
 *           example: 100
 *         pricePerHour:
 *           type: number
 *           example: 75
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     DedicatedBookingInvoice:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 5
 *         bookingId:
 *           type: integer
 *           example: 12
 *         subtotal:
 *           type: number
 *           example: 550
 *         tax:
 *           type: number
 *           example: 77
 *         discount:
 *           type: number
 *           example: 0
 *         total:
 *           type: number
 *           example: 627
 *         issuedAt:
 *           type: string
 *           format: date-time
 *         paidAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 */

/**
 * @swagger
 * /api/dedicated-bookings/pricing:
 *   get:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Get dedicated booking pricing settings
 *     description: Mobile can use this to prefill baseFare and pricePerHour before creating a dedicated booking.
 *     responses:
 *       200:
 *         description: Pricing settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DedicatedBookingPricing'
 */
router.get('/pricing', pricingCtrl.getPricing);

/**
 * @swagger
 * /api/dedicated-bookings/pricing:
 *   put:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Update dedicated booking pricing settings
 *     description: Admin dashboard endpoint. Mobile developers usually read pricing with GET only.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pricePerKm:
 *                 type: number
 *                 example: 0
 *               pricePerDay:
 *                 type: number
 *                 example: 0
 *               pricePerTrip:
 *                 type: number
 *                 example: 0
 *               baseFare:
 *                 type: number
 *                 example: 100
 *               pricePerHour:
 *                 type: number
 *                 example: 75
 *     responses:
 *       200:
 *         description: Pricing settings updated
 */
router.put('/pricing', pricingCtrl.updatePricing);

/**
 * @swagger
 * /api/dedicated-bookings:
 *   post:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Create a dedicated booking
 *     description: Creates a private dedicated booking for a rider. Response may include clientSecret for payment confirmation.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DedicatedBookingCreateRequest'
 *     responses:
 *       201:
 *         description: Booking created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DedicatedBooking'
 *       400:
 *         description: Validation or booking business rule failed
 */
router.post('/', ctrl.create);

/**
 * @swagger
 * /api/dedicated-bookings:
 *   get:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: List dedicated bookings
 *     description: Use userId for rider booking history, driverId for driver assigned bookings, or status/date filters for admin views.
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         example: 1
 *       - in: query
 *         name: driverId
 *         schema:
 *           type: integer
 *         example: 7
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, DRIVER_ASSIGNED, ON_THE_WAY, ACTIVE, COMPLETED, CANCELLED, EXPIRED]
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-05-01
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         example: 2026-05-31
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Dedicated bookings list
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /api/dedicated-bookings/available:
 *   get:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: List available dedicated bookings for drivers
 *     security:
 *       - bearerAuth: []
 *     description: Driver-only endpoint. Returns future PENDING/APPROVED bookings without an assigned driver.
 *     responses:
 *       200:
 *         description: Available bookings for driver app
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Driver role required
 */
router.get('/available', authenticate, authorize('driver'), ctrl.listAvailable);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/invoice:
 *   get:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Get booking invoice
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking invoice
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DedicatedBookingInvoice'
 *       404:
 *         description: Invoice not found
 */
router.get('/:id/invoice', ctrl.getInvoice);

/**
 * @swagger
 * /api/dedicated-bookings/{id}:
 *   get:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Get dedicated booking details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking details
 *       404:
 *         description: Booking not found
 */
router.get('/:id', ctrl.getById);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/status:
 *   patch:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Update dedicated booking status
 *     description: Admin/internal endpoint for changing booking lifecycle status.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, DRIVER_ASSIGNED, ON_THE_WAY, ACTIVE, COMPLETED, CANCELLED, EXPIRED]
 *                 example: APPROVED
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', ctrl.updateStatus);

/**
 * @swagger
 * /api/dedicated-bookings/{id}:
 *   delete:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Delete dedicated booking
 *     description: Cannot delete ACTIVE bookings.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking deleted
 */
router.delete('/:id', ctrl.remove);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/assign-driver:
 *   post:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Assign driver to dedicated booking
 *     security:
 *       - bearerAuth: []
 *     description: Admin/fleet endpoint used by the dashboard to assign a driver.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driverId]
 *             properties:
 *               driverId:
 *                 type: integer
 *                 example: 7
 *     responses:
 *       200:
 *         description: Driver assigned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin or fleet role required
 */
router.post('/:id/assign-driver', authenticate, authorize('admin', 'fleet'), ctrl.assignDriver);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/accept:
 *   post:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Driver accepts a dedicated booking
 *     security:
 *       - bearerAuth: []
 *     description: Driver-only endpoint. Assigns the current authenticated driver to the booking.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking accepted by driver
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Driver role required
 */
router.post('/:id/accept', authenticate, authorize('driver'), ctrl.acceptByDriver);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/start:
 *   post:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Start dedicated booking trip
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking started and status becomes ACTIVE
 */
router.post('/:id/start', ctrl.start);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/end:
 *   post:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: End dedicated booking trip
 *     description: Completes the booking, captures payment if configured, and generates invoice.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking completed
 */
router.post('/:id/end', ctrl.end);

/**
 * @swagger
 * /api/dedicated-bookings/{id}/cancel:
 *   post:
 *     tags: [Mobile Dedicated Bookings]
 *     summary: Cancel dedicated booking
 *     description: Cancels a booking and applies the configured cancellation/refund flow.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 12
 *     responses:
 *       200:
 *         description: Booking cancelled
 */
router.post('/:id/cancel', ctrl.cancel);

router.use(dedicatedBookingErrorHandler);

export default router;
