# Module Ownership Map

This map helps developers find where to edit quickly and safely.

## Core Bootstrap

- App entry, middleware, routes, sockets, cron:
  - `server.js`
- Shared middleware:
  - `middleware/auth.js`
  - `middleware/requestContext.js`
  - `middleware/securityAuditMiddleware.js`
  - `middleware/securityHardening.js`

## Mobile User Domain

- Route declarations:
  - `routes/user/mobileUserRoutes.js`
- Auth/profile/wallet/static:
  - `controllers/user/mobileAuthController.js`
  - `controllers/user/mobileProfileController.js`
  - `controllers/user/mobileWalletController.js`
  - `controllers/user/mobileStaticController.js`
- Service/booking/offer flow:
  - `controllers/user/mobileServiceController.js`
  - `controllers/user/mobileBookingController.js`
  - `controllers/user/mobileOfferController.js`
  - `controllers/user/mobileUserBookingController.js`

## Mobile Driver Domain

- Route declarations:
  - `routes/driver/mobileDriverRoutes.js`
- Driver auth/profile/rides:
  - `controllers/driver/mobileAuthController.js`
  - `controllers/driver/mobileDriverController.js`
  - `controllers/driver/mobileRideController.js`
  - `controllers/driver/mobileNotificationController.js`

## Ride Request Domain (Web/Admin + shared)

- Route declarations:
  - `routes/rideRequests.js`
- Ride request handlers:
  - `controllers/rideRequest/createRide.js`
  - `controllers/rideRequest/listAndDetail.js`
  - `controllers/rideRequest/statusAndActions.js`
  - `controllers/rideRequest/bidAndRating.js`
  - `controllers/rideRequest/exportRides.js`

## Payment / Wallet Domain

- Payment routes/controllers:
  - `routes/payments.js`
  - `controllers/paymentController.js`
  - `controllers/payskyPaymentController.js`
  - `controllers/payskyNotificationController.js`
  - `controllers/payskyWalletNotificationController.js`
- Shared payment completion service:
  - `services/ridePaymentCompletionService.js`
- Wallet controllers:
  - `controllers/wallet/balanceAndHistory.js`
  - `controllers/wallet/transactions.js`
  - `controllers/wallet/walletTopupController.js`
  - `controllers/wallet/backfill.js`
- Wallet service:
  - `services/walletLedgerService.js`

## Pricing / Category / Multi-Service Domain

- Routes:
  - `routes/serviceCategoryRoutes.js`
  - `routes/vehicleCategoryRoutes.js`
  - `routes/pricingRuleRoutes.js`
  - `routes/categoryFeatureRoutes.js`
  - `routes/categoryZoneRoutes.js`
- Controllers:
  - `controllers/serviceCategoryController.js`
  - `controllers/vehicleCategoryController.js`
  - `controllers/pricingRuleController.js`
  - `controllers/categoryFeatureController.js`
  - `controllers/categoryZoneController.js`
- Shared pricing util:
  - `utils/pricingCalculator.js`

## Dedicated Booking Domain

- Routes:
  - `routes/dedicatedBookings.js`
- Controllers/services:
  - `controllers/dedicatedBookingController.js`
  - `controllers/dedicatedBookingPricingController.js`
  - `services/dedicatedBookingService.js`
  - `services/dedicatedBookingPaymentService.js`
- Realtime/scheduler:
  - `utils/dedicatedBookingSocket.js`
  - `utils/dedicatedBookingScheduler.js`

## Negotiation Domain

- Routes:
  - `routes/negotiations.js`
- Controller/service/helpers:
  - `controllers/negotiationController.js`
  - `utils/negotiationHelper.js`

## Admin / Dashboard Domain

- Main routes:
  - `routes/admin.js`
  - `routes/dashboard.js`
  - `routes/reports.js`
- Key controllers:
  - `controllers/dashboardController.js`
  - `controllers/reportController.js`
  - `controllers/subAdminController.js`
  - `controllers/permissionController.js`
  - `controllers/roleController.js`

## Data Layer

- Prisma client:
  - `utils/prisma.js`
- Schema/migrations/seeds:
  - `prisma/schema.prisma`
  - `prisma/migrations/*`
  - `prisma/seed*.js`

## Testing

- Shared setup:
  - `tests/setup.js`
- Safety contracts:
  - `tests/mobileBookingSafety.test.js`
  - `tests/mobileOfferValidationSafety.test.js`
  - `tests/securityHardening.test.js`

## Suggested Ownership Model (example)

- Team A: Mobile User (`controllers/user/*`, user mobile routes)
- Team B: Driver + Real-time (`controllers/driver/*`, socket handlers)
- Team C: Payments/Wallet (`controllers/paysky*`, `controllers/wallet/*`, services)
- Team D: Pricing/Categories (`pricing/category` controllers + utils)
- Team E: Platform/Infra (`server.js`, middleware, prisma, docs/tests standards)

