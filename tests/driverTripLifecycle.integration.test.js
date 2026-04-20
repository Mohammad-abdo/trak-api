/**
 * Full HTTP lifecycle: accepted ride → arrived → started → complete (+ location ping).
 *
 * Prerequisites: database schema must match Prisma (`npx prisma migrate deploy`).
 * Skip in CI without DB: `SKIP_DRIVER_TRIP_E2E=1`
 *
 * Run before deploy:
 *   npm run test:driver-trip-e2e
 */
import jwt from "jsonwebtoken";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import mobileDriverRoutes from "../routes/driver/mobileDriverRoutes.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

const RIDER_EMAIL = "driver_trip_e2e_rider@test.local";
const DRIVER_EMAIL = "driver_trip_e2e_driver@test.local";

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
    app.use("/apimobile/driver", mobileDriverRoutes);
    return app;
}

describe.skipIf(process.env.SKIP_DRIVER_TRIP_E2E === "1")(
    "Driver trip lifecycle (integration, real DB)",
    () => {
    const app = buildApp();
    let riderId;
    let driverId;
    let driverToken;
    let rideId;

    beforeAll(async () => {
        await prisma.$queryRaw`SELECT 1`;

        const rider = await prisma.user.upsert({
            where: { email: RIDER_EMAIL },
            update: { status: "active", userType: "rider" },
            create: {
                firstName: "E2E",
                lastName: "Rider",
                email: RIDER_EMAIL,
                contactNumber: "0999111222333",
                password: "x",
                userType: "rider",
                status: "active",
            },
        });
        const driver = await prisma.user.upsert({
            where: { email: DRIVER_EMAIL },
            update: { status: "active", userType: "driver" },
            create: {
                firstName: "E2E",
                lastName: "Driver",
                email: DRIVER_EMAIL,
                contactNumber: "0999111222444",
                password: "x",
                userType: "driver",
                status: "active",
            },
        });
        riderId = rider.id;
        driverId = driver.id;
        driverToken = signToken(driverId);

        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                driverId,
                status: "accepted",
                negotiationStatus: "none",
                totalAmount: 50,
                subtotal: 50,
                baseFare: 50,
                paymentType: "cash",
                startLatitude: "30.04",
                startLongitude: "31.23",
                endLatitude: "30.05",
                endLongitude: "31.24",
            },
        });
        rideId = ride.id;
    });

    afterAll(async () => {
        if (rideId) {
            await prisma.payment.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.walletHistory.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.rideRequest.deleteMany({ where: { id: rideId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it("POST /location/update returns 200 for assigned driver", async () => {
        const res = await request(app)
            .post("/apimobile/driver/location/update")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ latitude: 30.04, longitude: 31.23, currentHeading: 90 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("POST /rides/update-status arrived → started", async () => {
        const r1 = await request(app)
            .post("/apimobile/driver/rides/update-status")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ booking_id: rideId, status: "arrived" });

        expect(r1.status).toBe(200);
        expect(r1.body.success).toBe(true);
        expect(r1.body.data.status).toBe("arrived");

        const r2 = await request(app)
            .post("/apimobile/driver/rides/update-status")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ rideRequestId: rideId, status: "started" });

        expect(r2.status).toBe(200);
        expect(r2.body.data.status).toBe("started");
    });

    it("POST /rides/complete marks ride completed", async () => {
        const res = await request(app)
            .post("/apimobile/driver/rides/complete")
            .set("Authorization", `Bearer ${driverToken}`)
            .send({ booking_id: rideId, tips: 0 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe("completed");
    });
});
