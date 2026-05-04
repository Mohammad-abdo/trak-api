# Driver “available rides” — realtime (Socket + HTTP)

## Deploy checklist (backend)

Production must run a build that includes:

1. **[`server.js`](../server.js)** — On Socket.IO connect with valid JWT, **active** users auto-join `user-{id}`; **drivers** also join `driver-{id}` (no client `join-driver-room` required, but it remains supported).
2. **[`controllers/user/mobileBookingController.js`](../controllers/user/mobileBookingController.js)** — After `POST .../user/booking/create`, emits `new-ride-available` to drivers in radius **and** to online drivers missing DB GPS (`serverHint: 'no_db_location'`).

Set **`JWT_SECRET`** (and optional **`SOCKET_PATH`**, **`SOCKET_ENFORCE_AUTH`**) consistently with the mobile app.

## Mobile app contract

| Mechanism | Role |
|-----------|------|
| `GET /apimobile/driver/rides/available?latitude=&longitude=` | **Source of truth** for the list (pricing, rider, distance, rejections). |
| `GET /apimobile/driver/rides/available/poll?latitude=&longitude=` | **Lightweight** check every ~5s; if `count > 0`, call full `.../available`. |
| Socket `new-ride-available` and `new_ride_request` | **Wake-up** — debounce then **refetch** full `.../available` with **current** GPS. |
| `POST /apimobile/driver/location/update` | Keeps DB coords aligned with device (helps broadcast + `replayPendingRidesForDriver`). |
| Socket `connect` / `reconnect` | Refetch `.../available` once. |

Socket client: same **origin** as API (no `/api` suffix on Socket URL unless your gateway differs), JWT in `auth: { token }`, and **`path`** matching server `SOCKET_PATH` (default `/socket.io`).

## Runnable smoke script (reference)

From `backend/`:

```bash
set DRIVER_JWT=your_driver_jwt_here
set BASE_URL=http://localhost:5000
node scripts/driver-available-rides-smoke.mjs
```

Or: `npm run driver:available-smoke` (see `package.json`).

This demonstrates debounced refetch, poll, location ping, and both socket event names.
