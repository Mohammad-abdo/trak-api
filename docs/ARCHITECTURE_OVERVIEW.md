# Architecture Overview (Backend)

This page gives developers a quick mental model of how the backend works.

## 1) Runtime Components

- HTTP API: Express app (`server.js`)
- Database layer: Prisma + MySQL (`utils/prisma.js`, `prisma/schema.prisma`)
- Realtime: Socket.IO rooms (`server.js`)
- Optional messaging: MQTT (`utils/mqttService.js`)
- Background jobs:
  - Scheduled ride activation (`utils/scheduledRideService.js`)
  - Dedicated booking auto-complete (`utils/dedicatedBookingScheduler.js`)

## 2) Request Lifecycle (HTTP)

```txt
Client Request
  -> requestContextMiddleware (requestId, clientIp)
  -> CORS + parsing + security headers
  -> securityAuditMiddleware (optional logging)
  -> auth middleware (if protected route)
  -> route handler (routes/*)
  -> controller (controllers/*)
  -> service/util/prisma
  -> JSON response
```

## 3) API Layering Style

```txt
routes/*            => endpoint mapping
controllers/*       => transport + orchestration
services/*          => business workflows
utils/*             => helpers/integrations
prisma/*            => data model and migrations
```

## 4) Realtime (Socket.IO) Flow

```txt
Mobile/Web Client
  -> socket connect
  -> join-user-room / join-driver-room / subscribe-ride
  -> server emits events:
       ride-request-accepted
       driver-offer-cancelled
       trip-tracking-started
       trip-completed
       trip-cancelled
```

When `SOCKET_ENFORCE_AUTH=1`, room joins/subscriptions are authorization-checked.

## 5) Payment Callback Flow (PaySky)

```txt
PaySky webhook POST
  -> payskyNotificationController
  -> signature + merchant/terminal checks
  -> resolve ride + validate amount/currency
  -> completePaidGatewayPayment service
       - mark payment paid (idempotent)
       - credit driver wallet safely
  -> admin notification + acknowledgment response
```

## 6) Booking & Offer Core Flow (Mobile User)

```txt
Select Service -> vehicle types + pricing rule
Create Booking -> ride_request row with pricing snapshot
Near Drivers    -> online/available driver search
Accept Driver   -> assign driver + emit socket event
Track/Status    -> polling + socket updates
Cancel/End/Rate -> status transition + rating rows
```

## 7) Driver Core Flow (Mobile Driver)

```txt
Login/availability/location updates
Receive rides (list + socket)
Accept/arrive/start/complete/cancel
Payments + wallet earnings
Ratings and history
```

## 8) Data Consistency Patterns

- Transactions used in sensitive money/status flows.
- Idempotency checks in payment completion paths.
- Pricing snapshot fields saved on `ride_requests` for stability.

## 9) Safety Constraints For Refactors

1. Keep route paths and methods stable.
2. Keep response keys stable (additive changes only).
3. Add tests before/after critical refactors.
4. Prefer feature flags for behavior changes.

## 10) Recommended Reading Order For New Developers

1. `server.js`
2. `routes/user/mobileUserRoutes.js` and `routes/driver/mobileDriverRoutes.js`
3. `controllers/user/mobileBookingController.js`
4. `controllers/user/mobileOfferController.js`
5. `controllers/driver/mobileRideController.js`
6. `controllers/payskyNotificationController.js`
7. `docs/RESPONSE_CONTRACT_POLICY.md`

