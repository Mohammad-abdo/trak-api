# Flutter Socket.IO (Driver + Rider) — Production Guide

This file is meant to be handed to the Flutter developer.

## 1) Connection details (production)

- **Base URL**: `https://qeema-track.nodeteam.site`
- **Socket Path**: `/socket.io` (unless backend sets `SOCKET_PATH` to something else)
- **JWT**: same JWT you use for REST (`Authorization: Bearer <JWT>`).  
  For Socket.IO send it in handshake: `auth: { token: "<JWT>" }`

### Important
Socket.IO is **event-driven**. It does **not** “return a list” like REST.
Events are **hints** → after receiving an event, you call the REST endpoint to fetch the authoritative data.

## 2) Fix for “connect_error websocket error”

If you see `connect_error websocket error`, it usually means the reverse proxy / CDN blocks WebSocket upgrade.

**Workaround (recommended): start with polling, allow websocket later**

- Use transports: `['polling', 'websocket']`
- Keep `path: '/socket.io'`

This is proven to connect on production in our environment.

## 3) Minimal Flutter connection (socket_io_client)

Add dependency:

```yaml
dependencies:
  socket_io_client: ^2.0.3+1
```

Connection code:

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

IO.Socket connectSocket({
  required String baseUrl,      // https://qeema-track.nodeteam.site
  required String socketPath,   // /socket.io
  required String jwt,
}) {
  final socket = IO.io(
    baseUrl,
    IO.OptionBuilder()
        .setPath(socketPath)
        // Polling-first fixes websocket upgrade issues behind some proxies:
        .setTransports(['polling', 'websocket'])
        .setAuth({'token': jwt})
        .enableReconnection()
        .setReconnectionAttempts(double.infinity.toInt())
        .setReconnectionDelay(1000)
        .setTimeout(20000)
        .build(),
  );

  socket.onConnect((_) {
    print('[socket] connected id=${socket.id}');
  });

  socket.onConnectError((e) {
    print('[socket] connect_error: $e');
  });

  socket.onDisconnect((reason) {
    print('[socket] disconnected: $reason');
  });

  socket.on('socket-auth-error', (data) {
    print('[socket] socket-auth-error: $data');
  });

  return socket;
}
```

## 4) Rooms (how routing works)

Server auto-joins rooms after successful JWT connect:

- All **active** users: `user-{id}`
- Drivers (userType=driver): `driver-{id}`

> If driver account is not `status=active`, it will NOT auto-join rooms, so it will miss events.

Ride room is manual:

- Client must emit `subscribe-ride` to join `ride-{rideId}`
- And `unsubscribe-ride` to leave it

```dart
socket.emit('subscribe-ride', rideId);
socket.emit('unsubscribe-ride', rideId);
```

## 5) Driver “Available rides” — required events + REST refetch

### Events to listen (Driver)
- `new-ride-available`  (primary)
- `new_ride_request`    (legacy/scheduled paths)

### Action
On either event:
1) get **current GPS** (lat/lng)
2) debounce 300–500ms
3) call REST:

`GET /apimobile/driver/rides/available?latitude={lat}&longitude={lng}`

Optional fallback polling (while screen is open):
`GET /apimobile/driver/rides/available/poll?latitude={lat}&longitude={lng}`
If `count > 0` → call full `/available`.

## 6) Trip lifecycle events (Ride room)

After ride is accepted and you have `rideId`, both Rider and Driver should:

```dart
socket.emit('subscribe-ride', rideId);
```

Then listen:
- `ride-arrived`                   (driver arrived)
- `ride-started`                   (trip started)
- `driver-location-for-ride`        (location stream for this ride)
- `trip-completed`                 (trip ended)
- `trip-cancelled`                 (trip cancelled)
- `trip-sync`                      (ride state sync for both)
- `driver-trip-sync`               (driver-only sync)

## 7) Rider events (User room)

Listen on rider app:
- `driver-offer-received`          (unified: bid/negotiation/direct accept)
- `ride-negotiation-offer`         (counter offer)
- `ride-negotiation-rejected`
- `trip-tracking-started`

## 8) Full “trip flow” (what to do, in order)

1) **Rider REST**: `POST /apimobile/user/booking/create` → get `booking_id` (rideId)
2) **Rider REST**: `POST /apimobile/user/offers/near-drivers` (broadcast)
3) **Driver Socket**: receives `new-ride-available` → Driver REST `GET /driver/rides/available`
4) **Driver REST**: `POST /apimobile/driver/rides/respond` (accept or negotiating)
5) **Both sockets**: `emit('subscribe-ride', rideId)`
6) **Driver REST**: `POST /apimobile/driver/rides/update-status` with `arrived` then `started`
7) **Driver REST**: `POST /apimobile/driver/rides/complete`
8) **Ride room**: receive `trip-completed` → show summary + rating

## 9) Troubleshooting checklist

### A) Socket connects but no events arrive
- Ensure user is `status=active` (server only auto-joins rooms for active users)
- Ensure driver is `userType=driver`
- Ensure you are connected with correct JWT (same environment / same JWT_SECRET)
- Ensure you called `subscribe-ride` for ride room events

### B) `connect_error websocket error`
- Use transports `['polling', 'websocket']` (polling-first)
- Confirm `path` matches server (`/socket.io` by default)
- If using nginx, check websocket upgrade headers for `/socket.io/`

### C) Web app (Vercel) CORS errors
- Browser requires `FRONTEND_URL` on backend to include `https://offer-go.vercel.app`
- Flutter native apps do not typically hit browser CORS restrictions

