#!/usr/bin/env node
/**
 * Reference driver flow: Socket.IO + lightweight poll + full GET /rides/available + location/update.
 * Mirrors what a production driver app should do (see docs/driver-available-rides-realtime.md).
 *
 * Usage (from backend/):
 *   DRIVER_JWT=eyJ... BASE_URL=http://localhost:5000 node scripts/driver-available-rides-smoke.mjs
 *
 * Optional:
 *   DRIVER_LAT=24.7136 DRIVER_LNG=46.6753 SOCKET_PATH=/socket.io
 */
import "dotenv/config";
import { io } from "socket.io-client";

const BASE_URL = (process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
const TOKEN = process.env.DRIVER_JWT;
const LAT = parseFloat(process.env.DRIVER_LAT || "24.7136");
const LNG = parseFloat(process.env.DRIVER_LNG || "46.6753");
const SOCKET_PATH = (process.env.SOCKET_PATH || "/socket.io").trim() || "/socket.io";
const POLL_MS = parseInt(process.env.POLL_MS || "5000", 10);
const LOCATION_MS = parseInt(process.env.LOCATION_MS || "25000", 10);
const DEBOUNCE_MS = parseInt(process.env.DEBOUNCE_MS || "400", 10);

if (!TOKEN) {
  console.error("Missing DRIVER_JWT (driver Bearer token).");
  process.exit(1);
}

if (!Number.isFinite(LAT) || !Number.isFinite(LNG)) {
  console.error("Invalid DRIVER_LAT / DRIVER_LNG");
  process.exit(1);
}

async function fetchAvailable() {
  const u = new URL(`${BASE_URL}/apimobile/driver/rides/available`);
  u.searchParams.set("latitude", String(LAT));
  u.searchParams.set("longitude", String(LNG));
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(json?.message || `GET /rides/available HTTP ${res.status}`);
  }
  return json;
}

async function fetchPoll() {
  const u = new URL(`${BASE_URL}/apimobile/driver/rides/available/poll`);
  u.searchParams.set("latitude", String(LAT));
  u.searchParams.set("longitude", String(LNG));
  const res = await fetch(u, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `poll HTTP ${res.status}`);
  return json;
}

async function postLocation() {
  const res = await fetch(`${BASE_URL}/apimobile/driver/location/update`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ latitude: LAT, longitude: LNG, currentHeading: 0 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `location/update HTTP ${res.status}`);
  return json;
}

let debounceTimer = null;
function debouncedRefresh(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    try {
      const j = await fetchAvailable();
      const n = Array.isArray(j?.data?.rides) ? j.data.rides.length : 0;
      console.log(`[available] ${n} ride(s)  (${reason})`);
    } catch (e) {
      console.error("[available] error:", e.message);
    }
  }, DEBOUNCE_MS);
}

async function pollTick() {
  try {
    const j = await fetchPoll();
    const count = j?.data?.count ?? 0;
    if (count > 0) {
      console.log(`[poll] count=${count} rideIds=`, j?.data?.rideIds);
      debouncedRefresh("poll");
    }
  } catch (e) {
    console.error("[poll] error:", e.message);
  }
}

const socket = io(BASE_URL, {
  auth: { token: TOKEN },
  path: SOCKET_PATH.startsWith("/") ? SOCKET_PATH : `/${SOCKET_PATH}`,
  transports: ["polling", "websocket"],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000,
});

socket.on("connect", () => {
  console.log("[socket] connect", socket.id);
  debouncedRefresh("socket-connect");
});

socket.on("connect_error", (err) => {
  console.error("[socket] connect_error", err?.message);
});

socket.on("disconnect", (reason) => {
  console.log("[socket] disconnect", reason);
});

socket.on("new-ride-available", (payload) => {
  console.log("[socket] new-ride-available", payload?.booking_id ?? payload);
  debouncedRefresh("new-ride-available");
});

socket.on("new_ride_request", (payload) => {
  console.log("[socket] new_ride_request", payload?.rideId ?? payload?.booking_id ?? payload);
  debouncedRefresh("new_ride_request");
});

console.log(`Listening on ${BASE_URL} (socket path=${SOCKET_PATH})  poll=${POLL_MS}ms  location=${LOCATION_MS}ms`);
console.log("Ctrl+C to exit.");

try {
  await postLocation();
  console.log("[location] initial update ok");
} catch (e) {
  console.warn("[location] initial update skipped:", e.message);
}

await fetchAvailable()
  .then((j) => {
    const n = Array.isArray(j?.data?.rides) ? j.data.rides.length : 0;
    console.log(`[available] initial ${n} ride(s)`);
  })
  .catch((e) => console.error("[available] initial error:", e.message));

const pollId = setInterval(pollTick, POLL_MS);
const locId = setInterval(() => {
  postLocation().catch((e) => console.warn("[location]", e.message));
}, LOCATION_MS);

function shutdown() {
  clearInterval(pollId);
  clearInterval(locId);
  if (debounceTimer) clearTimeout(debounceTimer);
  socket.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
