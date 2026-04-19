# Driver mobile API — Rides

Base URL: `{API}/apimobile/driver`  
All endpoints require: `Authorization: Bearer <driver_jwt_token>` (except where noted).

Envelope for most handlers using `successResponse`:

```json
{ "success": true, "message": "<string>", "data": <payload> }
```

Errors:

```json
{ "success": false, "message": "<reason>" }
```

---

## GET `/rides` — My ride history (paginated, filterable)

**Query parameters**

| Parameter   | Description |
|------------|-------------|
| `status`   | Filter by ride `status`; omit or use `all` for no filter |
| `page`     | Page number (default `1`) |
| `per_page` | Page size (default `15`) |
| `sortBy`   | Field to sort (default `createdAt`) |
| `sortOrder`| `asc` or `desc` (default `desc`) |
| `fromDate` | ISO date — `createdAt >= fromDate` |
| `toDate`   | ISO date — `createdAt <= end of day` |

**Response** (`200`) — uses `res.json` directly (no `message` field):

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "riderId": 2,
      "driverId": 108,
      "status": "completed",
      "totalAmount": 45.5,
      "startAddress": "...",
      "endAddress": "...",
      "startLatitude": "30.04",
      "startLongitude": "31.23",
      "endLatitude": "30.05",
      "endLongitude": "31.24",
      "paymentType": "cash",
      "createdAt": "2026-04-18T10:00:00.000Z",
      "rider": {
        "id": 2,
        "firstName": "John",
        "lastName": "Doe",
        "contactNumber": "01000000000",
        "avatar": "/uploads/..."
      },
      "service": {
        "id": 1,
        "name": "City Ride",
        "nameAr": "..."
      }
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "per_page": 15,
    "total_pages": 7
  }
}
```

`data` items are full `RideRequest` rows for this driver plus nested `rider` and `service` as selected in code.

---

## GET `/rides/{id}` — Single ride details

**Path:** `id` — ride request ID (integer).

**Response** (`200`):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 1,
    "riderId": 2,
    "driverId": 108,
    "status": "completed",
    "totalAmount": 45.5,
    "negotiatedFare": null,
    "negotiationStatus": "none",
    "startAddress": "...",
    "endAddress": "...",
    "payments": [
      {
        "id": 10,
        "paymentStatus": "paid",
        "paymentType": "cash",
        "amount": 45.5
      }
    ],
    "ratings": [],
    "negotiations": [],
    "rider": {
      "id": 2,
      "firstName": "John",
      "lastName": "Doe",
      "contactNumber": "01000000000",
      "avatar": "/uploads/..."
    },
    "service": {
      "id": 1,
      "name": "City Ride",
      "nameAr": "..."
    }
  }
}
```

- `payments`: latest one (`take: 1`, `orderBy createdAt desc`).
- `ratings`: related `RideRequestRating` rows.
- `negotiations`: related `RideNegotiation` rows, newest first.

**Errors:** `400` invalid id, `404` not found, `403` not your ride.

---

## GET `/rides/available` — Available ride requests near driver

**Query parameters (required)**

| Parameter   | Description |
|------------|-------------|
| `latitude` | Driver current latitude |
| `longitude`| Driver current longitude |

**Response** (`200`) when not blocked:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "rides": [
      {
        "id": 5,
        "rider": {
          "id": 2,
          "name": "John Doe",
          "avatar": "/uploads/...",
          "phone": "01000000000",
          "rating": 4.5
        },
        "pickup": {
          "latitude": "30.04",
          "longitude": "31.23",
          "address": "Pickup address"
        },
        "dropoff": {
          "latitude": "30.05",
          "longitude": "31.24",
          "address": "Dropoff address"
        },
        "service": { "id": 1, "name": "...", "nameAr": "..." },
        "vehicleCategory": {
          "id": 3,
          "name": "Sedan",
          "nameAr": "...",
          "capacity": 4
        },
        "pricing": {
          "totalAmount": 40,
          "estimatedPrice": {
            "estimatedTotal": 42,
            "breakdown": {},
            "currency": "EGP"
          },
          "baseFare": 15,
          "distance": 2.5,
          "duration": 12,
          "paymentType": "cash"
        },
        "distance": 1.2,
        "createdAt": "2026-04-18T10:00:00.000Z",
        "isScheduled": false,
        "scheduledTime": null
      }
    ],
    "total": 1,
    "searchRadius": 5,
    "driverLocation": { "latitude": 30.04, "longitude": 31.23 }
  }
}
```

- Rides: `pending`, unassigned (`driverId` null), within admin search radius, sorted by distance (closest first), max 20.
- Excludes rides this driver already rejected (`cancelledDriverIds`).

**When rejection cooldown is active** (`200`):

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "availableRides": [],
    "isDriverBlocked": true,
    "blockMessage": "You are blocked from viewing new rides. Try again in N minutes.",
    "remainingMinutes": 15
  }
}
```

**Errors:** `400` if `latitude` or `longitude` missing.

---

## POST `/rides/respond` — Accept, reject, or negotiate

**Body (JSON)**

| Field            | Type    | Required | Description |
|-----------------|---------|----------|-------------|
| `rideRequestId` | number/string | yes | Ride ID |
| `accept`        | boolean | yes | `true` = accept, `false` = reject |
| `proposedFare`  | number  | no | If set and differs from ride `totalAmount`, opens negotiation |
| `rejectReason`  | string  | no | When rejecting |

**Success — direct accept** (`200`):

```json
{
  "success": true,
  "message": "Ride accepted successfully",
  "data": {
    "rideRequestId": 5,
    "status": "accepted"
  }
}
```

**Success — counter-offer (negotiation)** (`200`):

```json
{
  "success": true,
  "message": "Counter offer sent to rider",
  "data": {
    "rideRequestId": 5,
    "status": "negotiating",
    "proposedFare": 50
  }
}
```

**Success — reject** (`200`):

```json
{
  "success": true,
  "message": "Ride rejected",
  "data": {
    "rideRequestId": 5,
    "status": "rejected",
    "reason": "Too far"
  }
}
```

**Errors:** `400` validation, `404` not found, `429` rejection cooldown when rejecting.

---

## POST `/rides/update-status` — Arrived / started

**Body (JSON)**

| Field           | Type | Required | Description |
|----------------|------|----------|-------------|
| `rideRequestId`| any  | yes | Ride ID |
| `status`       | string | yes | **`arrived`** or **`started`** only |

**Response** (`200`):

```json
{
  "success": true,
  "message": "Ride status updated to arrived",
  "data": {
    "id": 5,
    "status": "arrived",
    "driverId": 108,
    "...": "full updated RideRequest row"
  }
}
```

**Errors:** `400` invalid status or id, `404`, `403`.

---

## POST `/rides/complete` — Complete ride

**Body (JSON)**

| Field           | Type | Required | Description |
|----------------|------|----------|-------------|
| `rideRequestId`| any  | yes | Ride ID |
| `tips`         | number | no | Added to fare for total |

Fare used: negotiated fare if `negotiationStatus === "accepted"` and `negotiatedFare` set; else `totalAmount`.  
Creates a `Payment` row; for `cash`, credits driver wallet per system commission settings.

**Response** (`200`):

```json
{
  "success": true,
  "message": "Ride completed successfully",
  "data": {
    "id": 5,
    "status": "completed",
    "tips": 5,
    "totalAmount": 50.5,
    "...": "full RideRequest after update"
  }
}
```

**Errors:** `400`, `404`, `403`.

---

## POST `/rides/cancel` — Driver cancel

**Body (JSON)**

| Field           | Type | Required | Description |
|----------------|------|----------|-------------|
| `rideRequestId`| any  | yes | Ride ID |
| `reason`       | string | no | Cancellation reason |

**Response** (`200`):

```json
{
  "success": true,
  "message": "Ride cancelled",
  "data": null
}
```

Ride updated to `status: "cancelled"`, `cancelBy: "driver"`, `driverId` cleared.

---

## POST `/rides/rate-rider` — Rate rider after trip

**Body (JSON)**

| Field           | Type | Required | Description |
|----------------|------|----------|-------------|
| `rideRequestId`| any  | yes | Ride ID |
| `rating`       | number | yes | Rating value |
| `comment`      | string | no | Optional text |

**Response** (`200`):

```json
{
  "success": true,
  "message": "Rating saved",
  "data": null
}
```

**Errors:** `400` if `rideRequestId` or `rating` missing, `404`, `403`.

---

## POST `/rides/apply-bid` — Apply bid on ride request

**Body (JSON)**

| Field           | Type | Required | Description |
|----------------|------|----------|-------------|
| `rideRequestId`| any  | yes | Ride ID |
| `bidAmount`    | number | yes | Bid amount |

**Response** (`200`):

```json
{
  "success": true,
  "message": "Bid applied successfully",
  "data": null
}
```

Creates `RideRequestBid` and sets `rideHasBid: true` on the ride.

**Errors:** `400`, `404`.

---

## Driver notifications (`/apimobile/driver`)

Base path: `{API}/apimobile/driver`  
Auth: `Authorization: Bearer <driver_jwt_token>`

### GET `/notifications` — Driver notifications (paginated)

**Query parameters**

| Parameter      | Default | Description |
|----------------|---------|-------------|
| `page`         | `1`     | Page number |
| `per_page`     | `20`    | Page size |
| `unread_only`  | `false` | Set to `true` to return only unread rows |

**Response** (`200`) — uses `res.json` (includes top-level `unreadCount`):

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "ride_update",
      "notifiableType": "User",
      "notifiableId": 108,
      "data": {},
      "readAt": null,
      "isRead": false,
      "createdAt": "2026-04-18T10:00:00.000Z",
      "updatedAt": "2026-04-18T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50,
    "page": 1,
    "per_page": 20,
    "total_pages": 3
  },
  "unreadCount": 5
}
```

Notifications are matched when `notifiableType` is one of `Driver`, `driver`, `User`, `user` and `notifiableId` equals the authenticated user id.

---

### PUT `/notifications/{id}/read` — Mark one notification as read

**Path:** `id` — notification primary key.

**Response** (`200`):

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": 1,
    "isRead": true,
    "readAt": "2026-04-18T12:00:00.000Z",
    "...": "full Notification row"
  }
}
```

**Errors:** Prisma may throw if `id` does not exist (`500` / unhandled).

---

### PUT `/notifications/read-all` — Mark all as read

**Response** (`200`):

```json
{
  "success": true,
  "message": "12 notifications marked as read",
  "data": { "count": 12 }
}
```

Updates all unread notifications for this user across the `notifiableType` variants listed above.

---

## Ride chat (`/apimobile/chat`)

Base path: `{API}/apimobile/chat` (mounted separately from `/apimobile/driver`)  
Auth: `Authorization: Bearer <driver_jwt_token>`

Chat is allowed for the **assigned driver** (or rider) of the ride. Sending new messages typically requires the ride to be in an “open” status (e.g. accepted / in progress); read-only history may still be available after completion — see `resolveRideChatAccess` / `403` responses.

Real-time: Socket.IO room `ride-{rideId}` events `chat:message`, `chat:read`, `chat:typing`.

---

### GET `/rides/{rideId}/messages` — Paginated chat history

**Query parameters**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit`   | `30`    | Page size, max `100` |
| `cursor`  | —       | Message `id` from previous response’s `nextCursor` to load **older** messages |

Messages are returned **oldest → newest** within the page. Ordering is by id descending from DB then reversed.

**Response** (`200`):

```json
{
  "success": true,
  "message": "Chat history fetched",
  "data": {
    "rideRequestId": 921,
    "status": "accepted",
    "senderType": "driver",
    "nextCursor": 155,
    "messages": [
      {
        "id": 184,
        "rideRequestId": 921,
        "senderId": 12,
        "senderType": "rider",
        "message": "I am at the gate.",
        "attachmentUrl": null,
        "isRead": true,
        "readAt": "2026-04-18T12:45:20.000Z",
        "createdAt": "2026-04-18T12:45:03.512Z"
      }
    ]
  }
}
```

- `nextCursor`: pass as `cursor` on the next request to fetch older messages; `null` when no more.

**Errors:** `400` invalid ride id, `401`, `403` (not participant or chat not available), `404` ride not found.

---

### POST `/rides/{rideId}/messages` — Send a message

**Body (JSON)**

| Field            | Required | Description |
|------------------|----------|-------------|
| `message`        | yes      | `1`…`2000` characters after sanitize |
| `attachmentUrl`  | no       | Optional URL string |

**Response** (`201`):

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "id": 186,
    "rideRequestId": 921,
    "senderId": 108,
    "senderType": "driver",
    "message": "On my way.",
    "attachmentUrl": null,
    "isRead": false,
    "readAt": null,
    "createdAt": "2026-04-18T12:46:10.112Z"
  }
}
```

**Errors:** `400` empty/invalid message, `401`, `403`, `404`, `429` rate limit (20 messages / 10s per user per ride).

---

### POST `/rides/{rideId}/read` — Mark incoming messages as read

Marks all messages **from the other party** (rider if you are driver) as read; emits `chat:read` on the ride room.

**Response** (`200`):

```json
{
  "success": true,
  "message": "Messages marked as read",
  "data": { "updated": 3 }
}
```

---

### GET `/rides/{rideId}/unread-count` — Unread badge count

Counts messages **from the other party** that are still unread.

**Response** (`200`):

```json
{
  "success": true,
  "message": "Unread count",
  "data": {
    "rideRequestId": 921,
    "unread": 2
  }
}
```

---

## Notes for clients

1. **Route order:** `GET /rides/available` must be registered **before** `GET /rides/:id` so `available` is not parsed as an id (this order is already used in the server).
2. **`rideRequestId`** may be string or number; server parses via `parseRideRequestIdParam`.
3. **List rides** response shape differs slightly (no top-level `message`) from other `successResponse` endpoints.
4. **Notifications list** (`GET /apimobile/driver/notifications`) also omits a top-level `message` and adds `unreadCount`.
5. **Chat** lives under **`/apimobile/chat`**, not under **`/apimobile/driver`**.
