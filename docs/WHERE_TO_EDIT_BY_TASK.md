# Where To Edit By Task

Use this file to jump directly to the right module.

## 1) Booking Price Missing / Wrong

- User booking APIs:
  - `controllers/user/mobileBookingController.js`
  - `controllers/user/mobileUserBookingController.js`
- Price engine:
  - `utils/pricingCalculator.js`
  - `controllers/pricingRuleController.js`
- DB schema:
  - `prisma/schema.prisma` (`RideRequest`, `PricingRule`, `VehicleCategory`)

## 2) Nearby Drivers / Offer Flow Issues

- Main controller:
  - `controllers/user/mobileOfferController.js`
- Driver location updates:
  - `controllers/driver/mobileDriverController.js`
  - `controllers/driver/mobileRideController.js`
- Socket events:
  - `server.js` socket section

## 3) Driver Cannot Accept/Start/Complete Ride

- Driver ride logic:
  - `controllers/driver/mobileRideController.js`
- Ride status logic:
  - `controllers/rideRequest/statusAndActions.js`
  - `controllers/rideRequest/listAndDetail.js`

## 4) Payment Not Marked Paid / Wallet Not Updated

- Payment callbacks:
  - `controllers/payskyNotificationController.js`
  - `controllers/payskyWalletNotificationController.js`
- Payment completion:
  - `services/ridePaymentCompletionService.js`
- Wallet entries:
  - `controllers/wallet/walletTopupController.js`
  - `controllers/wallet/transactions.js`
  - `services/walletLedgerService.js`

## 5) OTP / Login Problems

- Auth middleware:
  - `middleware/auth.js`
- Web auth:
  - `controllers/auth/login.js`
  - `controllers/auth/otp.js`
- Mobile auth:
  - `controllers/user/mobileAuthController.js`
  - `controllers/driver/mobileAuthController.js`
- OTP service/helper:
  - `services/otpVerificationService.js`
  - `utils/otpHelper.js`

## 6) API Security / Hardening

- Security middleware:
  - `middleware/securityHardening.js`
  - `middleware/securityAuditMiddleware.js`
- Request context/logging:
  - `middleware/requestContext.js`
- Bootstrap:
  - `server.js`

## 7) Category / Zone / Service Admin Pages Data

- Controllers:
  - `controllers/serviceCategoryController.js`
  - `controllers/vehicleCategoryController.js`
  - `controllers/categoryZoneController.js`
  - `controllers/geographicZoneController.js`
- Routes:
  - `routes/serviceCategoryRoutes.js`
  - `routes/vehicleCategoryRoutes.js`
  - `routes/categoryZoneRoutes.js`
  - `routes/geographicZoneRoutes.js`

## 8) Dedicated Booking Flow

- Controllers/services:
  - `controllers/dedicatedBookingController.js`
  - `controllers/dedicatedBookingPricingController.js`
  - `services/dedicatedBookingService.js`
  - `services/dedicatedBookingPaymentService.js`
- Realtime/scheduler:
  - `utils/dedicatedBookingSocket.js`
  - `utils/dedicatedBookingScheduler.js`

## 9) Adding New Endpoint Safely

1. Add route in `routes/*`.
2. Add controller in matching `controllers/*`.
3. Reuse service or create one in `services/*`.
4. Add/extend regression tests under `tests/*`.
5. Update docs:
   - `docs/api-contract-baseline.md` (if contract-sensitive)
   - Swagger annotations (if route is mobile API)

