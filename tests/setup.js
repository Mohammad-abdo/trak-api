/**
 * Shared test setup: lightweight Express app + helpers for auth tokens.
 */
import express from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import { authenticate } from "../middleware/auth.js";
import negotiationRoutes from "../routes/negotiations.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";

export function buildApp() {
    const app = express();
    app.use(express.json());
    app.use("/api/negotiations", negotiationRoutes);
    return app;
}

export function signToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "1h" });
}

/**
 * Ensure a test rider + driver exist and return their IDs + tokens.
 * Uses upsert so tests are idempotent.
 */
export async function ensureTestUsers() {
    const rider = await prisma.user.upsert({
        where: { email: "test_rider_nego@test.com" },
        update: {},
        create: {
            firstName: "TestRider",
            lastName: "Nego",
            email: "test_rider_nego@test.com",
            contactNumber: "09990001111",
            password: "hashed",
            userType: "rider",
            status: "active",
        },
    });

    const driver = await prisma.user.upsert({
        where: { email: "test_driver_nego@test.com" },
        update: {},
        create: {
            firstName: "TestDriver",
            lastName: "Nego",
            email: "test_driver_nego@test.com",
            contactNumber: "09990002222",
            password: "hashed",
            userType: "driver",
            status: "active",
        },
    });

    return {
        rider: { id: rider.id, token: signToken(rider.id) },
        driver: { id: driver.id, token: signToken(driver.id) },
    };
}

/**
 * Create a ride request owned by the rider with the driver assigned.
 */
export async function createTestRide(riderId, driverId, totalAmount = 100) {
    return prisma.rideRequest.create({
        data: {
            riderId,
            driverId,
            totalAmount,
            subtotal: totalAmount,
            baseFare: totalAmount,
            status: "pending",
            negotiationStatus: "none",
        },
    });
}

/**
 * Enable/disable negotiation in settings table.
 */
export async function setNegotiationEnabled(enabled, maxPercent = 20, maxRounds = 3, timeout = 90) {
    const pairs = [
        ["ride_negotiation_enabled", String(enabled)],
        ["ride_negotiation_max_percent", String(maxPercent)],
        ["ride_negotiation_max_rounds", String(maxRounds)],
        ["ride_negotiation_timeout_seconds", String(timeout)],
    ];
    for (const [key, value] of pairs) {
        await prisma.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
        });
    }
}

/**
 * Clean up test data (ride negotiations, rides, settings).
 */
export async function cleanup(rideIds = []) {
    if (rideIds.length) {
        await prisma.rideNegotiation.deleteMany({ where: { rideRequestId: { in: rideIds } } });
        await prisma.rideRequest.deleteMany({ where: { id: { in: rideIds } } });
    }
}

export { prisma };
