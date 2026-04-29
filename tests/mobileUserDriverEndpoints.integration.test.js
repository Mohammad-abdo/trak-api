/**
 * Endpoint-by-endpoint integration tests for mobile user + driver APIs.
 * Covers: device token, push preference, booking (normal/special), near-drivers window,
 * driver available window, accept/status/location/complete, tip, notifications unread/read.
 *
 * Requires: MySQL reachable via DATABASE_URL, Prisma schema in sync.
 * Skip with: SKIP_MOBILE_ENDPOINTS_E2E=1
 */
import jwt from "jsonwebtoken";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import mobileUserRoutes from "../routes/user/mobileUserRoutes.js";
import mobileDriverRoutes from "../routes/driver/mobileDriverRoutes.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

const RIDER_EMAIL = "mobile_endpoints_rider@test.local";
const DRIVER_EMAIL = "mobile_endpoints_driver@test.local";

function signToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "2h" });
}

function buildApp() {
    const app = express();
    app.use(express.json());
    app.set("io", {
        to: () => ({ emit: () => {} }),
        emit: () => {},
    });
    app.use("/apimobile/user", mobileUserRoutes);
    app.use("/apimobile/driver", mobileDriverRoutes);
    return app;
}

async function ensureServiceAndPricing() {
    const sc = await prisma.serviceCategory.upsert({
        where: { slug: "e2e-service-category-2" },
        update: { status: 1 },
        create: { slug: "e2e-service-category-2", name: "E2E2", status: 1 },
    });
    const vc = await prisma.vehicleCategory.upsert({
        where: { slug: "e2e-vehicle-category-2" },
        update: { status: 1, serviceCategoryId: sc.id },
        create: {
            slug: "e2e-vehicle-category-2",
            name: "E2E Vehicle 2",
            serviceCategoryId: sc.id,
            status: 1,
        },
    });

    // Service.name is NOT unique, so we seed by find-first.
    const existingService = await prisma.service.findFirst({
        where: { vehicleCategoryId: vc.id, status: 1 },
        select: { id: true },
    });
    if (!existingService) {
        await prisma.service.create({
            data: { name: "E2E Service 2", vehicleCategoryId: vc.id, status: 1 },
        });
    }

    // Ensure at least one active pricing rule
    const existingRule = await prisma.pricingRule.findFirst({
        where: { vehicleCategoryId: vc.id, status: 1 },
        select: { id: true },
    });
    if (!existingRule) {
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

    return vc.id;
}

describe.skipIf(process.env.SKIP_MOBILE_ENDPOINTS_E2E === "1")(
    "Mobile user + driver endpoints (integration, real DB)",
    () => {
        const app = buildApp();
        let riderId;
        let driverId;
        let riderToken;
        let driverToken;
        let vehicleCategoryId;
        let rideIdNormal;
        let rideIdNegotiation;
        let rideIdSpecialFuture;

        beforeAll(async () => {
            await prisma.$queryRaw`SELECT 1`;

            vehicleCategoryId = await ensureServiceAndPricing();

            const rider = await prisma.user.upsert({
                where: { email: RIDER_EMAIL },
                update: { status: "active", userType: "rider", pushNotificationsEnabled: true },
                create: {
                    firstName: "E2E",
                    lastName: "Rider",
                    email: RIDER_EMAIL,
                    contactNumber: "0999111222101",
                    password: "x",
                    userType: "rider",
                    status: "active",
                    pushNotificationsEnabled: true,
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
                    pushNotificationsEnabled: true,
                    lastRejectionAt: null,
                    driverRejectionCount: 0,
                },
                create: {
                    firstName: "E2E",
                    lastName: "Driver",
                    email: DRIVER_EMAIL,
                    contactNumber: "0999111222102",
                    password: "x",
                    userType: "driver",
                    status: "active",
                    isOnline: true,
                    isAvailable: true,
                    latitude: "30.0444",
                    longitude: "31.2357",
                    pushNotificationsEnabled: true,
                },
            });

            riderId = rider.id;
            driverId = driver.id;
            riderToken = signToken(riderId);
            driverToken = signToken(driverId);
        });

        afterAll(async () => {
            const ids = [rideIdNormal, rideIdNegotiation, rideIdSpecialFuture].filter(Boolean);
            if (ids.length) {
                await prisma.payment.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.walletHistory.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.rideNegotiation.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.rideRequestBid.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.rideRequestRating.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.rideRequestHistory.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.rideChatMessage.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.complaint.deleteMany({ where: { rideRequestId: { in: ids } } }).catch(() => {});
                await prisma.rideRequest.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
            }
            await prisma.$disconnect();
        });

        it("User: POST /device-token registers token", async () => {
            const res = await request(app)
                .post("/apimobile/user/device-token")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({ fcmToken: "test-fcm-token", playerId: "test-player-id", appVersion: "0.0.1" });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.fcmToken).toBe("test-fcm-token");
        });

        it("User: GET/PUT /notifications/push-preference toggles", async () => {
            const g1 = await request(app)
                .get("/apimobile/user/notifications/push-preference")
                .set("Authorization", `Bearer ${riderToken}`);
            expect(g1.status).toBe(200);
            expect(g1.body.success).toBe(true);

            const u1 = await request(app)
                .put("/apimobile/user/notifications/push-preference")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({ enabled: false });
            expect(u1.status).toBe(200);
            expect(u1.body.data.pushNotificationsEnabled).toBe(false);

            const u2 = await request(app)
                .put("/apimobile/user/notifications/push-preference")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({ enabled: true });
            expect(u2.status).toBe(200);
            expect(u2.body.data.pushNotificationsEnabled).toBe(true);
        });

        it("User: POST /booking/create creates NORMAL ride (pending)", async () => {
            const res = await request(app)
                .post("/apimobile/user/booking/create")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    vehicle_id: vehicleCategoryId,
                    paymentMethod: 0,
                    from: { lat: 30.0444, lng: 31.2357, address: "Pickup" },
                    to: { lat: 30.0595, lng: 31.2234, address: "Dropoff" },
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("pending");
            rideIdNormal = res.body.data.booking_id;
        });

        it("User: POST /booking/create creates SPECIAL ride (scheduled)", async () => {
            const future = new Date(Date.now() + 45 * 60 * 1000).toISOString();
            const res = await request(app)
                .post("/apimobile/user/booking/create")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    vehicle_id: vehicleCategoryId,
                    paymentMethod: 0,
                    from: { lat: 30.0444, lng: 31.2357, address: "Pickup" },
                    to: { lat: 30.0595, lng: 31.2234, address: "Dropoff" },
                    bookingType: "special",
                    scheduledAt: future,
                });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("scheduled");
            rideIdSpecialFuture = res.body.data.booking_id;
        });

        it("User: POST /offers/near-drivers returns [] when special is > 30min away", async () => {
            // Create a ride scheduled far in the future (2h), should not open offers yet.
            const farFuture = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            const created = await request(app)
                .post("/apimobile/user/booking/create")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    vehicle_id: vehicleCategoryId,
                    paymentMethod: 0,
                    from: { lat: 30.0444, lng: 31.2357, address: "Pickup" },
                    to: { lat: 30.0595, lng: 31.2234, address: "Dropoff" },
                    bookingType: "special",
                    scheduledAt: farFuture,
                });
            expect(created.status).toBe(201);
            const rideId = created.body.data.booking_id;

            const res = await request(app)
                .post("/apimobile/user/offers/near-drivers")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    booking_id: rideId,
                    booking_location: { lat: 30.0444, lng: 31.2357 },
                });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(0);

            // cleanup this extra ride
            await prisma.rideRequest.delete({ where: { id: rideId } }).catch(() => {});
        });

        it("Driver: GET /rides/available includes normal ride", async () => {
            const res = await request(app)
                .get("/apimobile/driver/rides/available")
                .set("Authorization", `Bearer ${driverToken}`)
                .query({ latitude: 30.0444, longitude: 31.2357 });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const rides = res.body.data?.rides || [];
            const ids = Array.isArray(rides) ? rides.map((r) => r.id) : [];
            expect(ids).toContain(rideIdNormal);
        });

        it("Auto-deletes expired unaccepted regular rides", async () => {
            // 1) Create a fresh normal ride
            const created = await request(app)
                .post("/apimobile/user/booking/create")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    vehicle_id: vehicleCategoryId,
                    paymentMethod: 0,
                    from: { lat: 30.0444, lng: 31.2357, address: "Pickup Expired" },
                    to: { lat: 30.0595, lng: 31.2234, address: "Dropoff Expired" },
                });
            expect(created.status).toBe(201);
            const staleRideId = created.body.data.booking_id;

            // 2) Force it to be old enough to expire (default timeout is 10 min)
            await prisma.rideRequest.update({
                where: { id: staleRideId },
                data: { createdAt: new Date(Date.now() - 12 * 60 * 1000) },
            });

            // 3) Trigger available-rides endpoint (this runs purge first)
            const avail = await request(app)
                .get("/apimobile/driver/rides/available")
                .set("Authorization", `Bearer ${driverToken}`)
                .query({ latitude: 30.0444, longitude: 31.2357 });
            expect(avail.status).toBe(200);
            expect(avail.body.success).toBe(true);

            // 4) Ensure ride was physically deleted from DB
            const deleted = await prisma.rideRequest.findUnique({ where: { id: staleRideId } });
            expect(deleted).toBeNull();
        });

        it("Driver negotiation appears in User: POST /offers/near-drivers", async () => {
            // 1) Create a fresh pending ride for negotiation scenario
            const created = await request(app)
                .post("/apimobile/user/booking/create")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    vehicle_id: vehicleCategoryId,
                    paymentMethod: 0,
                    from: { lat: 30.0444, lng: 31.2357, address: "Pickup N" },
                    to: { lat: 30.0595, lng: 31.2234, address: "Dropoff N" },
                });
            expect(created.status).toBe(201);
            rideIdNegotiation = created.body.data.booking_id;

            // 2) Driver sends negotiation
            const propose = await request(app)
                .post("/apimobile/driver/negotiation/propose")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ rideRequestId: rideIdNegotiation, proposedFare: 25 });
            expect(propose.status).toBe(200);
            expect(propose.body.success).toBe(true);

            // 3) User checks near drivers for that booking
            const near = await request(app)
                .post("/apimobile/user/offers/near-drivers")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({
                    booking_id: rideIdNegotiation,
                    booking_location: { lat: 30.0444, lng: 31.2357 },
                });

            expect(near.status).toBe(200);
            expect(near.body.success).toBe(true);
            expect(Array.isArray(near.body.data)).toBe(true);
            expect(near.body.data.length).toBeGreaterThan(0);

            const offer = near.body.data.find((d) => d.id === driverId);
            expect(offer).toBeTruthy();
            expect(Number(offer.offeredPrice)).toBeCloseTo(25, 2);
            expect(Number(offer.basePrice)).toBeGreaterThan(0);
        });

        it("Driver: POST /rides/respond accept works", async () => {
            const res = await request(app)
                .post("/apimobile/driver/rides/respond")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ rideRequestId: rideIdNormal, accept: true });
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe("accepted");
        });

        it("Driver: arrived -> started -> location -> complete", async () => {
            const arrived = await request(app)
                .post("/apimobile/driver/rides/update-status")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ booking_id: rideIdNormal, status: "arrived" });
            expect(arrived.status).toBe(200);
            expect(arrived.body.data.status).toBe("arrived");

            const started = await request(app)
                .post("/apimobile/driver/rides/update-status")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ rideRequestId: rideIdNormal, status: "started" });
            expect(started.status).toBe(200);
            expect(started.body.data.status).toBe("started");

            const loc = await request(app)
                .post("/apimobile/driver/location/update")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ latitude: 30.045, longitude: 31.236, currentHeading: 90 });
            expect(loc.status).toBe(200);
            expect(loc.body.success).toBe(true);

            const complete = await request(app)
                .post("/apimobile/driver/rides/complete")
                .set("Authorization", `Bearer ${driverToken}`)
                .send({ booking_id: rideIdNormal, tips: 0 });
            expect(complete.status).toBe(200);
            expect(complete.body.data.status).toBe("completed");
        });

        it("User: POST /offers/tip adds tip and returns 201", async () => {
            const res = await request(app)
                .post("/apimobile/user/offers/tip")
                .set("Authorization", `Bearer ${riderToken}`)
                .send({ rideRequestId: rideIdNormal, amount: 5 });
            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.tips).toBeGreaterThanOrEqual(5);
        });

        it("User: notifications unread-count + read-all are callable", async () => {
            const unread = await request(app)
                .get("/apimobile/user/notifications/unread-count")
                .set("Authorization", `Bearer ${riderToken}`);
            expect(unread.status).toBe(200);
            expect(unread.body.success).toBe(true);

            const readAll = await request(app)
                .post("/apimobile/user/notifications/read-all")
                .set("Authorization", `Bearer ${riderToken}`);
            expect(readAll.status).toBe(200);
            expect(readAll.body.success).toBe(true);
        });
    }
);

