#!/usr/bin/env node
/**
 * Production E2E trip logger (Driver ⇄ Rider) for Socket.IO + REST.
 *
 * Goal: prove sockets work in a real environment by showing logs for:
 * - new-ride-available
 * - driver-offer-received / ride-negotiation-offer (when applicable)
 * - ride-arrived / ride-started
 * - trip-completed / trip-cancelled
 * - driver-trip-sync / trip-sync
 * - chat:* (if you trigger it from apps)
 *
 * Usage (PowerShell example):
 *   $env:BASE_URL="https://qeema-track.nodeteam.site"
 *   $env:SOCKET_PATH="/socket.io"
 *   $env:RIDER_JWT="eyJ..."
 *   $env:DRIVER_JWT="eyJ..."
 *   $env:VEHICLE_ID="1"
 *   node scripts/trip-socket-e2e-prod.mjs
 *
 * Notes:
 * - This script NEEDS real JWTs (rider + driver).
 * - It will create a booking, broadcast offers, accept it from the driver,
 *   subscribe both parties to ride-{id}, then mark arrived/started/complete.
 */

import "dotenv/config";
import { io } from "socket.io-client";

const BASE_URL = (process.env.BASE_URL || "https://qeema-track.nodeteam.site").replace(/\/+$/, "");
const SOCKET_PATH = (process.env.SOCKET_PATH || "/socket.io").trim() || "/socket.io";
const RIDER_JWT = process.env.RIDER_JWT || process.env.USER_JWT;
const DRIVER_JWT = process.env.DRIVER_JWT;

// Force polling-first when reverse proxies block WebSocket upgrade.
// Examples:
//   CLIENT_TRANSPORTS="polling"            (diagnostic)
//   CLIENT_TRANSPORTS="polling,websocket"  (recommended fallback)
//   CLIENT_TRANSPORTS="websocket,polling"  (default)
const CLIENT_TRANSPORTS = String(process.env.CLIENT_TRANSPORTS || "websocket,polling")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const VEHICLE_ID = parseInt(process.env.VEHICLE_ID || "", 10);
const LAT = parseFloat(process.env.LAT || "30.0444");
const LNG = parseFloat(process.env.LNG || "31.2357");
const TO_LAT = parseFloat(process.env.TO_LAT || "30.0595");
const TO_LNG = parseFloat(process.env.TO_LNG || "31.2234");

const USE_NEGOTIATION = String(process.env.USE_NEGOTIATION || "0") === "1";
const NEGOTIATION_FARE = parseFloat(process.env.NEGOTIATION_FARE || "0");

if (!RIDER_JWT) {
  console.error("Missing RIDER_JWT (or USER_JWT).");
  process.exit(1);
}
if (!DRIVER_JWT) {
  console.error("Missing DRIVER_JWT.");
  process.exit(1);
}
if (!Number.isFinite(VEHICLE_ID)) {
  console.error("Missing/invalid VEHICLE_ID (numeric).");
  process.exit(1);
}

function ts() {
  return new Date().toISOString();
}
function log(who, ...args) {
  console.log(`[${ts()}] [${who}]`, ...args);
}

async function httpJson(method, path, token, body = null) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || `${method} ${path} HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function bindLogs(who, socket) {
  const events = [
    // core
    "new-ride-available",
    "new_ride_request",
    "socket-auth-error",

    // user offer/negotiation
    "driver-offer-received",
    "ride-negotiation-offer",
    "ride-negotiation-rejected",
    "trip-tracking-started",

    // ride room lifecycle
    "ride-arrived",
    "ride-started",
    "trip-completed",
    "trip-cancelled",
    "driver-location-for-ride",
    "trip-sync",
    "driver-trip-sync",

    // misc
    "ride-request-accepted",
    "driver-offer-cancelled",
    "rider-awaiting-offers",
    "sos:alert",
    "ride:tip",

    // chat (legacy + Flutter dual names)
    "chat:message",
    "newMessage",
    "newAttachment",
    "chat:typing",
    "userTyping",
    "chat:read",
    "messageSeenUpdated",
    "messageDeleted",
    "chat:message-deleted",
    "messageDeliveredUpdated",
    "chat:message-delivered",
    "onlineStatusChanged",
    "userOnline",
    "userOffline",
    "chat:error",
  ];

  for (const ev of events) {
    socket.on(ev, (payload) => {
      log(who, `event=${ev}`, payload ?? null);
    });
  }
}

function connectSocket(who, token) {
  const socket = io(BASE_URL, {
    auth: { token },
    path: SOCKET_PATH.startsWith("/") ? SOCKET_PATH : `/${SOCKET_PATH}`,
    transports: CLIENT_TRANSPORTS,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  socket.on("connect", () => log(who, "connect", socket.id));
  socket.on("connect_error", (err) =>
    log(who, "connect_error", {
      message: err?.message || String(err),
      description: err?.description,
      context: err?.context,
    })
  );
  socket.on("disconnect", (reason) => log(who, "disconnect", reason));

  bindLogs(who, socket);
  return socket;
}

async function main() {
  log("main", "BASE_URL=", BASE_URL, "SOCKET_PATH=", SOCKET_PATH, "CLIENT_TRANSPORTS=", CLIENT_TRANSPORTS.join(","));

  const riderSocket = connectSocket("rider", RIDER_JWT);
  const driverSocket = connectSocket("driver", DRIVER_JWT);

  // Wait a moment for sockets to connect
  await new Promise((r) => setTimeout(r, 1200));

  // 1) Rider creates booking
  log("main", "Creating booking…");
  const bookingBody = {
    vehicle_id: VEHICLE_ID,
    paymentMethod: "cash",
    from: { lat: LAT, lng: LNG, address: "Tahrir Sq, Cairo (E2E)" },
    to: { lat: TO_LAT, lng: TO_LNG, address: "Zamalek, Cairo (E2E)" },
    ...(USE_NEGOTIATION && NEGOTIATION_FARE > 0 ? { requestedPrice: NEGOTIATION_FARE } : {}),
  };
  const bookingRes = await httpJson("POST", "/apimobile/user/booking/create", RIDER_JWT, bookingBody);
  const rideId = bookingRes?.data?.booking_id;
  if (!rideId) throw new Error("booking/create did not return data.booking_id");
  log("main", "booking_id=", rideId, "totalAmount=", bookingRes?.data?.totalAmount);

  // 2) Rider broadcasts offers request to nearby drivers
  log("main", "Calling offers/near-drivers (broadcast)…");
  await httpJson("POST", "/apimobile/user/offers/near-drivers", RIDER_JWT, {
    booking_id: rideId,
    booking_location: { lat: LAT, lng: LNG },
  });
  log("main", "Broadcast done. Waiting ~2s for driver socket events…");
  await new Promise((r) => setTimeout(r, 2000));

  // 3) Driver fetches available rides (verifies it can see the booking)
  log("main", "Driver GET rides/available (sanity)…");
  const available = await httpJson(
    "GET",
    `/apimobile/driver/rides/available?latitude=${encodeURIComponent(String(LAT))}&longitude=${encodeURIComponent(String(LNG))}`,
    DRIVER_JWT
  );
  const rides = Array.isArray(available?.data?.rides) ? available.data.rides : [];
  log("main", "available.rides.length=", rides.length);

  // 4) Driver accepts or negotiates
  log("main", USE_NEGOTIATION ? "Driver negotiating…" : "Driver accepting…");
  const respondBody = USE_NEGOTIATION
    ? { rideRequestId: rideId, status: "negotiating", proposedFare: Math.max(1, NEGOTIATION_FARE || 1) }
    : { rideRequestId: rideId, status: "accepted" };
  await httpJson("POST", "/apimobile/driver/rides/respond", DRIVER_JWT, respondBody);
  log("main", "Driver responded. Waiting ~2s for user socket events…");
  await new Promise((r) => setTimeout(r, 2000));

  // 5) Subscribe both sockets to ride room
  log("main", "Subscribing both sockets to ride room… rideId=", rideId);
  riderSocket.emit("subscribe-ride", rideId);
  driverSocket.emit("subscribe-ride", rideId);
  await new Promise((r) => setTimeout(r, 800));

  // If negotiation was used, you can now accept it from the user side (optional).
  if (USE_NEGOTIATION) {
    log("main", "Negotiation mode: you may need to call /apimobile/user/negotiation/accept from the app.");
    log("main", "This script will continue to status updates anyway.");
  }

  // 6) Driver updates status arrived → started
  log("main", "Driver update-status: arrived…");
  await httpJson("POST", "/apimobile/driver/rides/update-status", DRIVER_JWT, { rideRequestId: rideId, status: "arrived" });
  await new Promise((r) => setTimeout(r, 1200));

  log("main", "Driver update-status: started…");
  await httpJson("POST", "/apimobile/driver/rides/update-status", DRIVER_JWT, { rideRequestId: rideId, status: "started" });
  await new Promise((r) => setTimeout(r, 1200));

  // 7) Driver completes ride
  log("main", "Driver complete ride…");
  await httpJson("POST", "/apimobile/driver/rides/complete", DRIVER_JWT, { rideRequestId: rideId, tips: 0 });
  log("main", "Completed. Keep this process open to observe any late events.");

  // Keep running to observe events
  setInterval(() => {}, 60_000);
}

main().catch((e) => {
  console.error(`[${ts()}] [fatal]`, e?.stack || e?.message || e);
  process.exit(1);
});

