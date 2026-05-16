/**
 * Rider cancel must notify assigned driver even without driver_id in body.
 * Skip: SKIP_RIDE_CANCEL_WS=1
 */

import http from "http";
import express from "express";
import { Server as SocketIoServer } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import mobileUserRoutes from "../routes/user/mobileUserRoutes.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";
const RIDER_EMAIL = "rc_cancel_rider@test.local";
const DRIVER_EMAIL = "rc_cancel_driver@test.local";

function signToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "2h" });
}

function waitForEvent(socket, event, ms = 5000) {
    return new Promise((resolve, reject) => {
        const tid = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);
        socket.once(event, (data) => {
            clearTimeout(tid);
            resolve(data);
        });
    });
}

describe.skipIf(process.env.SKIP_RIDE_CANCEL_WS === "1")("Ride cancel — driver socket notify", () => {
    let httpServer;
    let io;
    let app;
    let baseUrl;
    let riderToken;
    let riderId;
    let driverId;
    let rideId;
    let driverSocket;

    beforeAll(async () => {
        await prisma.$queryRaw`SELECT 1`;

        app = express();
        app.use(express.json());
        httpServer = http.createServer(app);
        io = new SocketIoServer(httpServer, { cors: { origin: "*" }, transports: ["websocket"] });

        io.on("connection", (socket) => {
            const token = socket.handshake?.auth?.token;
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    socket.data.user = { id: decoded.id, userType: "driver" };
                } catch (_) {}
            }
            socket.on("join-driver-room", (id) => socket.join(`driver-${id}`));
        });

        app.set("io", io);
        app.use("/apimobile/user", mobileUserRoutes);

        await new Promise((r) => httpServer.listen(0, r));
        const { port } = httpServer.address();
        baseUrl = `http://127.0.0.1:${port}`;

        const rider = await prisma.user.upsert({
            where: { email: RIDER_EMAIL },
            update: { status: "active", userType: "rider" },
            create: {
                firstName: "RC",
                lastName: "Rider",
                email: RIDER_EMAIL,
                contactNumber: "0955555551",
                password: "x",
                userType: "rider",
                status: "active",
            },
        });
        const driver = await prisma.user.upsert({
            where: { email: DRIVER_EMAIL },
            update: { status: "active", userType: "driver" },
            create: {
                firstName: "RC",
                lastName: "Driver",
                email: DRIVER_EMAIL,
                contactNumber: "0955555552",
                password: "x",
                userType: "driver",
                status: "active",
            },
        });
        riderId = rider.id;
        driverId = driver.id;
        riderToken = signToken(riderId);

        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                driverId,
                status: "accepted",
                startAddress: "A",
                endAddress: "B",
                totalAmount: 10,
            },
        });
        rideId = ride.id;

        driverSocket = await new Promise((resolve, reject) => {
            const s = ioClient(baseUrl, {
                auth: { token: signToken(driverId) },
                transports: ["websocket"],
                forceNew: true,
            });
            const tid = setTimeout(() => reject(new Error("connect timeout")), 8000);
            s.on("connect", () => {
                clearTimeout(tid);
                s.emit("join-driver-room", driverId);
                resolve(s);
            });
            s.on("connect_error", reject);
        });
        await new Promise((r) => setTimeout(r, 100));
    });

    afterAll(async () => {
        driverSocket?.disconnect();
        await new Promise((r) => httpServer.close(r));
        if (rideId) {
            await prisma.rideRequest.deleteMany({ where: { id: rideId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it("cancel-trip without driver_id still notifies driver room", async () => {
        const p = waitForEvent(driverSocket, "trip-cancelled");

        const res = await fetch(`${baseUrl}/apimobile/user/offers/cancel-trip`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${riderToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ booking_id: rideId }),
        });
        expect(res.status).toBe(200);

        const evt = await p;
        expect(evt).toMatchObject({
            booking_id: rideId,
            rideRequestId: rideId,
            cancelled_by: "rider",
        });
    });
});
