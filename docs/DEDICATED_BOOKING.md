# Dedicated Private Booking System

Isolated feature: **no changes to existing Ride logic.**

## Architecture

- **Controllers:** `controllers/dedicatedBookingController.js`
- **Services:** `services/dedicatedBookingService.js`, `services/dedicatedBookingPaymentService.js`
- **Repository:** `repositories/dedicatedBookingRepository.js` (all Prisma access)
- **Validation:** `validators/dedicatedBookingValidators.js` (Zod)
- **Error handling:** `middleware/dedicatedBookingErrorHandler.js`
- **Config:** `config/dedicatedBookingConfig.js` (cancellation policy, tax rate)

## Database (Prisma)

- **Enums:** `BookingStatus`, `PaymentStatus`
- **Models:** `DedicatedBooking`, `BookingInvoice`, `BookingLocationUpdate`
- **Relations:** User (rider + driver), VehicleCategory

Apply migrations:

```bash
npx prisma migrate dev --name dedicated_booking_system
# or in production:
npx prisma migrate deploy
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dedicated-bookings` | Create booking (body: userId, vehicleCategoryId, pickup*, dropoff*, bookingDate, startTime, durationHours, baseFare, pricePerHour, notes?) |
| GET | `/api/dedicated-bookings` | List (query: userId?, driverId?, status?, fromDate?, toDate?, page?, limit?) |
| GET | `/api/dedicated-bookings/:id` | Get by ID |
| GET | `/api/dedicated-bookings/:id/invoice` | Get invoice (after COMPLETED) |
| PATCH | `/api/dedicated-bookings/:id/status` | Update status (body: status) |
| DELETE | `/api/dedicated-bookings/:id` | Delete (not allowed if ACTIVE) |
| POST | `/api/dedicated-bookings/:id/assign-driver` | Assign driver (body: driverId) |
| POST | `/api/dedicated-bookings/:id/start` | Start trip (sets startedAt, status ACTIVE) |
| POST | `/api/dedicated-bookings/:id/end` | End trip (COMPLETED, invoice, capture payment) |
| POST | `/api/dedicated-bookings/:id/cancel` | Cancel (refund per policy, release auth) |

## Pricing

`totalPrice = baseFare + (pricePerHour × durationHours)`. Distance is not used.

## Driver assignment

- **POST** `/api/dedicated-bookings/:id/assign-driver` with `{ "driverId": number }`.
- Validates driver exists and has no overlapping ACTIVE/APPROVED/DRIVER_ASSIGNED/ON_THE_WAY booking in the same time window.
- Sets status to `DRIVER_ASSIGNED`.

## Live tracking (Socket.io)

- **Driver** sends: `dedicated-booking-location` with `{ bookingId, currentLat, currentLng }`.
- Server saves to `booking_location_updates` and broadcasts to `user-{userId}` as `dedicated-booking-location-update`.
- **User** should join room: `join-user-room`, then listen for `dedicated-booking-location-update`.

## Auto-complete timer

- Cron runs every minute (`utils/dedicatedBookingScheduler.js`).
- For each ACTIVE booking where `startedAt + durationHours` has passed: set COMPLETED, set endedAt, capture payment, generate invoice.

## Pre-authorization (Stripe)

- Optional. Set `STRIPE_SECRET_KEY` and install `stripe`: `npm install stripe`.
- On create: PaymentIntent with `capture_method: 'manual'`; booking gets `PREAUTHORIZED` and `clientSecret` in response.
- On COMPLETED: capture PaymentIntent.
- On cancel: cancel PaymentIntent (release).

## Cancellation policy (configurable)

- **Env:** `DEDICATED_CANCELLATION_FULL_REFUND_HOURS` (default 24), `DEDICATED_CANCELLATION_HALF_CHARGE_HOURS` (default 2).
- More than 24h before start → full refund.
- Between 24h and 2h → 50% charge (policy only; Stripe release still applied if you use pre-auth).
- Less than 2h → no refund.

## Invoice

- Generated when booking becomes COMPLETED.
- Tax rate: `DEDICATED_BOOKING_TAX_RATE` (e.g. 0.15 for 15%).
- **GET** `/api/dedicated-bookings/:id/invoice` returns the invoice.

## Validations (Zod)

- Date/time not in past (service layer).
- Duration 1–24 hours.
- Coordinates in valid range.
- User and vehicle category exist.
- Driver availability and no overlapping bookings on assign.
