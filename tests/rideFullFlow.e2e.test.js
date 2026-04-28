/**
 * Full HTTP lifecycle (User creates booking -> Driver sees available -> Accept -> Arrived -> Started -> Location -> Complete).
 *
 * Requires: local MySQL reachable via DATABASE_URL, Prisma schema in sync.
 * Skip with: SKIP_RIDE_FULL_E2E=1
 */
import jwt from "jsonwebtoken";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import mobileUserRoutes from "../routes/user/mobileUserRoutes.js";
import mobileDriverRoutes from "../routes/driver/mobileDriverRoutes.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

const RIDER_EMAIL = "ride_full_e2e_rider@test.local";
const DRIVER_EMAIL = "ride_full_e2e_driver@test.local";

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

describe.skipIf(process.env.SKIP_RIDE_FULL_E2E === "1")("Ride full flow (integration, real DB)", () => {
    const app = buildApp();
    let riderId;
    let driverId;
    let riderToken;
    let driverToken;
    let rideId;
    let vehicleCategoryId;

    beforeAll(async () => {
        await prisma.$queryRaw`SELECT 1`;

        // Ensure base entities exist for booking pricing
        const sc = await prisma.serviceCategory.upsert({
            where: { slug: "e2e-service-category" },
            update: { status: 1 },
            create: { slug: "e2e-service-category", name: "E2E", status: 1 },
        });

        const vc = await prisma.vehicleCategory.upsert({
            where: { slug: "e2e-vehicle-category" },
            update: { status: 1, serviceCategoryId: sc.id },
            create: {
                slug: "e2e-vehicle-category",
                name: "E2E Vehicle",
                serviceCategoryId: sc.id,
                status: 1,
            },
        });
        vehicleCategoryId = vc.id;

        const existingService = await prisma.service.findFirst({
            where: { name: "E2E Service" },
            select: { id: true },
        });
        if (existingService) {
            await prisma.service.update({
                where: { id: existingService.id },
                data: { status: 1, vehicleCategoryId: vc.id },
            });
        } else {
            await prisma.service.create({
                data: { name: "E2E Service", vehicleCategoryId: vc.id, status: 1 },
            });
        }

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

        const rider = await prisma.user.upsert({
            where: { email: RIDER_EMAIL },
            update: { status: "active", userType: "rider" },
            create: {
                firstName: "E2E",
                lastName: "Rider",
                email: RIDER_EMAIL,
                contactNumber: "0999111222001",
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
            },
            create: {
                firstName: "E2E",
                lastName: "Driver",
                email: DRIVER_EMAIL,
                contactNumber: "0999111222002",
                password: "x",
                userType: "driver",
                status: "active",
                isOnline: true,
                isAvailable: true,
                latitude: "30.0444",
                longitude: "31.2357",
            },
        });

        riderId = rider.id;
        driverId = driver.id;
        riderToken = signToken(riderId);
        driverToken = signToken(driverId);
    });

    afterAll(async () => {
        if (rideId) {
            await prisma.payment.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.walletHistory.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.rideRequest.deleteMany({ where: { id: rideId } }).catch(() => {});
        }
        // keep seeded categories/services for developer inspection
        await prisma.$disconnect();
    });

    it("User creates booking", async () => {
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
        rideId = res.body.data.booking_id;
        expect(typeof rideId).toBe("number");
    });

    it("Driver sees ride in available list", async () => {
        const res = await request(app)
            .get("/apimobile/driver/rides/available")
            .set("Authorization", `Bearer ${driverToken}`)
            .query({ latitude: 30.0444, longitude: 31.2357 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const ids = (res.body.data?.availableRides || res.body.data?.rides || res.body.data || []).map((r) => r.id);
        expect(ids).toContain(rideId);
    });

    it("Driver accepts ride", async () => {
        const res = await request(app)
            .post("/apimobile/driver/rides/respond")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ rideRequestId: rideId, accept: true });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("accepted");
    });

    it("Driver updates status arrived -> started", async () => {
        const r1 = await request(app)
            .post("/apimobile/driver/rides/update-status")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ booking_id: rideId, status: "arrived" });
        expect(r1.status).toBe(200);
        expect(r1.body.data.status).toBe("arrived");

        const r2 = await request(app)
            .post("/apimobile/driver/rides/update-status")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ rideRequestId: rideId, status: "started" });
        expect(r2.status).toBe(200);
        expect(r2.body.data.status).toBe("started");
    });

    it("Driver sends location update", async () => {
        const res = await request(app)
            .post("/apimobile/driver/location/update")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ latitude: 30.045, longitude: 31.236, currentHeading: 90 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("Driver completes ride", async () => {
        const res = await request(app)
            .post("/apimobile/driver/rides/complete")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ booking_id: rideId, tips: 0 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("completed");
    });
});

