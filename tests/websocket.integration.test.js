/**
 * WebSocket Integration Tests — Full Trip Flow
 *
 * Verifies that Socket.IO events fire correctly at every stage:
 *   1. new-ride-available     → driver receives when user creates booking
 *   2. driver-offer-received  → user receives when driver directly accepts
 *   3. ride-request-accepted  → ride room receives on driver accept
 *   4. driver-location-update → emitted globally when driver updates location
 *   5. trip-completed         → ride room receives on trip completion
 *
 * Requires: local MySQL reachable via DATABASE_URL, Prisma schema in sync.
 * Skip with: SKIP_WS_E2E=1
 */

import http from "http";
import express from "express";
import { Server as SocketIoServer } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "../utils/prisma.js";
import mobileUserRoutes from "../routes/user/mobileUserRoutes.js";
import mobileDriverRoutes from "../routes/driver/mobileDriverRoutes.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";
const RIDER_EMAIL  = "ws_e2e_rider@test.local";
const DRIVER_EMAIL = "ws_e2e_driver@test.local";
const TEST_PORT    = 0; // OS assigns a free port

function signToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "2h" });
}

/** Wait for the next occurrence of `event` on `socket` within `ms` ms */
function waitForEvent(socket, event, ms = 4000) {
    return new Promise((resolve, reject) => {
        const tid = setTimeout(() => reject(new Error(`Timeout waiting for socket event "${event}"`)), ms);
        socket.once(event, (data) => { clearTimeout(tid); resolve(data); });
    });
}

/** Connect a socket.io-client and wait until it is connected */
function connectClient(url, token) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(url, {
            auth: { token },
            transports: ["websocket"],
            forceNew: true,
        });
        const tid = setTimeout(() => reject(new Error("Socket connect timeout")), 6000);
        socket.on("connect", () => { clearTimeout(tid); resolve(socket); });
        socket.on("connect_error", (err) => { clearTimeout(tid); reject(err); });
    });
}

describe.skipIf(process.env.SKIP_WS_E2E === "1")(
    "WebSocket — full trip flow (real server + real DB)",
    () => {
        // ── infrastructure ────────────────────────────────────────────────────
        let httpServer;
        let io;
        let serverUrl;
        let app;

        // ── test actors ───────────────────────────────────────────────────────
        let riderId, driverId;
        let riderToken, driverToken;
        let vehicleCategoryId;

        // ── per-test state ────────────────────────────────────────────────────
        let rideId;
        let riderSocket, driverSocket;

        // ── DB cleanup list ───────────────────────────────────────────────────
        const rideIds = [];

        // ─────────────────────────────────────────────────────────────────────
        beforeAll(async () => {
            // 1) Build real HTTP server + Socket.IO (same setup as server.js)
            app = express();
            app.use(express.json());
            httpServer = http.createServer(app);
            io = new SocketIoServer(httpServer, {
                cors: { origin: "*" },
                transports: ["websocket", "polling"],
                allowEIO3: true,
            });

            // Mirror the production socket handler
            io.on("connection", async (socket) => {
                const token = socket.handshake?.auth?.token;
                if (token) {
                    try {
                        const decoded = jwt.verify(token, JWT_SECRET);
                        socket.data.user = decoded;
                    } catch (_) {}
                }

                socket.on("join-user-room",   (userId)   => socket.join(`user-${userId}`));
                socket.on("join-driver-room",  (driverId) => socket.join(`driver-${driverId}`));
                socket.on("subscribe-ride",    (rideId)   => socket.join(`ride-${rideId}`));
            });

            // Attach routes (inject io so controllers can emit)
            app.set("io", io);
            app.use("/apimobile/user",   mobileUserRoutes);
            app.use("/apimobile/driver", mobileDriverRoutes);

            // Start on a free port
            await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve));
            const { port } = httpServer.address();
            serverUrl = `http://localhost:${port}`;

            // 2) Seed DB
            await prisma.$queryRaw`SELECT 1`;

            const sc = await prisma.serviceCategory.upsert({
                where: { slug: "ws-e2e-service-category" },
                update: { status: 1 },
                create: { slug: "ws-e2e-service-category", name: "WS E2E SC", status: 1 },
            });

            const vc = await prisma.vehicleCategory.upsert({
                where: { slug: "ws-e2e-vehicle-category" },
                update: { status: 1, serviceCategoryId: sc.id },
                create: {
                    slug: "ws-e2e-vehicle-category",
                    name: "WS E2E Vehicle",
                    serviceCategoryId: sc.id,
                    status: 1,
                },
            });
            vehicleCategoryId = vc.id;

            const svc = await prisma.service.findFirst({ where: { vehicleCategoryId: vc.id, status: 1 } });
            if (!svc) {
                await prisma.service.create({
                    data: { name: "WS E2E Service", vehicleCategoryId: vc.id, status: 1 },
                });
            }

            const rule = await prisma.pricingRule.findFirst({ where: { vehicleCategoryId: vc.id, status: 1 } });
            if (!rule) {
                await prisma.pricingRule.create({
                    data: {
                        vehicleCategoryId: vc.id,
                        baseFare: 10,
                        baseDistance: 5,
                        minimumFare: 10,
                        perDistanceAfterBase: 2,
                        perMinuteDrive: 0,
                        perMinuteWait: 0,
                        waitingTimeLimit: 0,
                        status: 1,
                    },
                });
            }

            const rider = await prisma.user.upsert({
                where: { email: RIDER_EMAIL },
                update: { status: "active", userType: "rider" },
                create: {
                    firstName: "WS",
                    lastName: "Rider",
                    email: RIDER_EMAIL,
                    contactNumber: "0911111111",
                    password: "x",
                    userType: "rider",
                    status: "active",
                },
            });

            const driver = await prisma.user.upsert({
                where: { email: DRIVER_EMAIL },
                update: {
                    status: "active",
                    userType: "driver",
                    isOnline: true,
                    isAvailable: true,
                    latitude: "30.0444",
                    longitude: "31.2357",
                    driverRejectionCount: 0,
                    lastRejectionAt: null,
                },
                create: {
                    firstName: "WS",
                    lastName: "Driver",
                    email: DRIVER_EMAIL,
                    contactNumber: "0922222222",
                    password: "x",
                    userType: "driver",
                    status: "active",
                    isOnline: true,
                    isAvailable: true,
                    latitude: "30.0444",
                    longitude: "31.2357",
                },
            });

            riderId    = rider.id;
            driverId   = driver.id;
            riderToken  = signToken(riderId);
            driverToken = signToken(driverId);

            // 3) Connect both sockets
            riderSocket  = await connectClient(serverUrl, riderToken);
            driverSocket = await connectClient(serverUrl, driverToken);

            // Join personal rooms
            riderSocket.emit("join-user-room",   riderId);
            driverSocket.emit("join-driver-room", driverId);

            // Small delay to ensure rooms are joined before tests fire
            await new Promise((r) => setTimeout(r, 150));
        });

        afterAll(async () => {
            riderSocket?.disconnect();
            driverSocket?.disconnect();

            await new Promise((r) => httpServer.close(r));

            if (rideIds.length) {
                await prisma.rideNegotiation.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.rideRequestBid.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.rideRequestRating.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.rideRequestHistory.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.rideChatMessage.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.complaint.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.walletHistory.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.payment.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
                await prisma.rideRequest.deleteMany({ where: { id: { in: rideIds } } }).catch(() => {});
            }

            await prisma.$disconnect();
        });

        // ─────────────────────────────────────────────────────────────────────
        // TEST 1 — new-ride-available
        // ─────────────────────────────────────────────────────────────────────
        it("Driver receives 'new-ride-available' when user creates a booking", async () => {
            // Listen BEFORE making the request
            const eventPromise = waitForEvent(driverSocket, "new-ride-available");

            const res = await request(app)
                .post("/apimobile/user/booking/create")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    vehicle_id: vehicleCategoryId,
                    paymentMethod: 0,
                    from: { lat: 30.0444, lng: 31.2357, address: "WS Pickup" },
                    to:   { lat: 30.0595, lng: 31.2234, address: "WS Dropoff" },
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            rideId = res.body.data.booking_id;
            rideIds.push(rideId);

            const event = await eventPromise;
            expect(event).toMatchObject({ booking_id: rideId });
            expect(Number(event.totalAmount)).toBeGreaterThan(0);
        });

        // ─────────────────────────────────────────────────────────────────────
        // TEST 2 — Polling endpoints (GET /poll)
        // ─────────────────────────────────────────────────────────────────────
        it("Driver: GET /rides/available/poll returns the new ride", async () => {
            const res = await request(app)
                .get("/apimobile/driver/rides/available/poll")
                .set("Authorization", `Bearer ${driverToken}`)
                .query({ latitude: 30.0444, longitude: 31.2357 });

            expect(res.status).toBe(200);
            expect(res.body.data.count).toBeGreaterThan(0);
            expect(res.body.data.rideIds).toContain(rideId);
        });

        it("User: GET /offers/near-drivers/:bookingId returns empty before any driver responds", async () => {
            const res = await request(app)
                .get(`/apimobile/user/offers/near-drivers/${rideId}`)
                .set("Authorization", `Bearer ${riderToken}`)
                .query({ lat: 30.0444, lng: 31.2357 });

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(0);
        });

        // ─────────────────────────────────────────────────────────────────────
        // TEST 3 — driver-offer-received + ride-request-accepted
        // ─────────────────────────────────────────────────────────────────────
        it("User receives 'driver-offer-received' when driver directly accepts", async () => {
            // Subscribe to ride room so we also get ride-request-accepted
            riderSocket.emit("subscribe-ride", rideId);
            await new Promise((r) => setTimeout(r, 100));

            const offerPromise = waitForEvent(riderSocket, "driver-offer-received");
            const acceptedPromise = waitForEvent(riderSocket, "ride-request-accepted");

            const res = await request(app)
                .post("/apimobile/driver/rides/respond")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ rideRequestId: rideId, accept: true });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe("accepted");

            const offerEvent    = await offerPromise;
            const acceptedEvent = await acceptedPromise;

            expect(offerEvent).toMatchObject({ rideRequestId: rideId, driverId, offerType: "direct_accept" });
            expect(acceptedEvent).toMatchObject({ rideRequestId: rideId, driverId });
        });

        it("User: GET /offers/near-drivers/:bookingId now returns the driver offer", async () => {
            const res = await request(app)
                .get(`/apimobile/user/offers/near-drivers/${rideId}`)
                .set("Authorization", `Bearer ${riderToken}`)
                .query({ lat: 30.0444, lng: 31.2357 });

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThan(0);
            const offer = res.body.data.find((d) => d.id === driverId);
            expect(offer).toBeTruthy();
        });

        // ─────────────────────────────────────────────────────────────────────
        // TEST 4 — Track driver (driver-location-update broadcast)
        // ─────────────────────────────────────────────────────────────────────
        it("Driver location update emits 'driver-location-update' globally", async () => {
            // Status arrived + started first so complete works later
            await request(app)
                .post("/apimobile/driver/rides/update-status")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ booking_id: rideId, status: "arrived" });

            await request(app)
                .post("/apimobile/driver/rides/update-status")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ rideRequestId: rideId, status: "started" });

            const locationPromise = waitForEvent(riderSocket, "driver-location-update");

            const locRes = await request(app)
                .post("/apimobile/driver/location/update")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ latitude: 30.045, longitude: 31.237, currentHeading: 90 });

            expect(locRes.status).toBe(200);
            expect(locRes.body.success).toBe(true);

            const locEvent = await locationPromise;
            expect(locEvent).toMatchObject({ driverId });
            expect(locEvent.lat).toBeCloseTo(30.045, 3);
            expect(locEvent.lng).toBeCloseTo(31.237, 3);
        });

        it("User: POST /offers/track-driver returns driver live coordinates", async () => {
            const res = await request(app)
                .post("/apimobile/user/offers/track-driver")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({ booking_id: rideId, driver_id: driverId });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const data = res.body.data;
            expect(data).toBeTruthy();
            expect(Number(data.driver_id)).toBe(driverId);
            // Location was updated to 30.045 in the previous test
            expect(parseFloat(data.driverCurrentLocation?.lat)).toBeCloseTo(30.045, 2);
        });

        // ─────────────────────────────────────────────────────────────────────
        // TEST 5 — trip-completed
        // ─────────────────────────────────────────────────────────────────────
        it("Ride room receives 'trip-completed' when driver completes the trip", async () => {
            const completedPromise = waitForEvent(riderSocket, "trip-completed");

            const res = await request(app)
                .post("/apimobile/driver/rides/complete")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ booking_id: rideId, tips: 0 });

            expect(res.status).toBe(200);
            expect(res.body.data.status).toBe("completed");

            const completedEvent = await completedPromise;
            expect(completedEvent).toMatchObject({ rideRequestId: rideId, driverId });
            expect(Number(completedEvent.totalAmount)).toBeGreaterThan(0);
        });
    }
);
