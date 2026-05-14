/**
 * Ride chat Socket.IO — legacy + Flutter event names (dual emit).
 * Requires DATABASE_URL + JWT_SECRET. Skip: SKIP_RIDE_CHAT_WS=1
 */

import http from "http";
import express from "express";
import { Server as SocketIoServer } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import { subscribeSocketToRide } from "../utils/rideSocketRooms.js";
import { registerRideChatHandlers } from "../utils/rideChatSocket.js";

/** Additive-only DDL for integration tests (avoids full `prisma db push --accept-data-loss`). */
async function ensureRideChatMessageColumnsForTest() {
    const stmts = [
        "ALTER TABLE `ride_chat_messages` ADD COLUMN `delivered_at` TIMESTAMP NULL DEFAULT NULL",
        "ALTER TABLE `ride_chat_messages` ADD COLUMN `deleted_at` TIMESTAMP NULL DEFAULT NULL",
        "ALTER TABLE `ride_chat_messages` ADD COLUMN `deleted_by_user_id` INT NULL DEFAULT NULL",
    ];
    for (const sql of stmts) {
        try {
            await prisma.$executeRawUnsafe(sql);
        } catch (e) {
            const msg = String(e?.message || e);
            if (!/Duplicate column name/i.test(msg) && !/already exists/i.test(msg)) {
                throw e;
            }
        }
    }
}

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";
const RIDER_EMAIL = "rc_flutter_rider@test.local";
const DRIVER_EMAIL = "rc_flutter_driver@test.local";

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

function connectClient(url, token) {
    return new Promise((resolve, reject) => {
        const socket = ioClient(url, {
            auth: { token },
            transports: ["websocket"],
            forceNew: true,
        });
        const tid = setTimeout(() => reject(new Error("connect timeout")), 8000);
        socket.on("connect", () => {
            clearTimeout(tid);
            resolve(socket);
        });
        socket.on("connect_error", (err) => {
            clearTimeout(tid);
            reject(err);
        });
    });
}

describe.skipIf(process.env.SKIP_RIDE_CHAT_WS === "1")("Ride chat socket — Flutter + legacy", () => {
    let httpServer;
    let io;
    let serverUrl;
    let riderId;
    let driverId;
    let rideId;
    let riderSocket;
    let driverSocket;
    const socketAuthEnforced = false;

    beforeAll(async () => {
        await prisma.$queryRaw`SELECT 1`;
        await ensureRideChatMessageColumnsForTest();

        const app = express();
        httpServer = http.createServer(app);
        io = new SocketIoServer(httpServer, {
            cors: { origin: "*" },
            transports: ["websocket", "polling"],
            allowEIO3: true,
        });

        io.on("connection", async (socket) => {
            const token = socket.handshake?.auth?.token;
            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    const user = await prisma.user.findUnique({
                        where: { id: decoded.id },
                        select: { id: true, userType: true, status: true },
                    });
                    if (user) socket.data.user = user;
                } catch (_) {}
            }

            socket.on("subscribe-ride", async (rideIdRaw) => {
                await subscribeSocketToRide(socket, rideIdRaw, { socketAuthEnforced, io });
            });
            socket.on("joinChat", async (payload) => {
                await subscribeSocketToRide(socket, payload, { socketAuthEnforced, io });
            });

            registerRideChatHandlers(socket, io);
        });

        await new Promise((resolve) => httpServer.listen(0, resolve));
        const { port } = httpServer.address();
        serverUrl = `http://127.0.0.1:${port}`;

        const rider = await prisma.user.upsert({
            where: { email: RIDER_EMAIL },
            update: { status: "active", userType: "rider" },
            create: {
                firstName: "RC",
                lastName: "Rider",
                email: RIDER_EMAIL,
                contactNumber: "0933333331",
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
                contactNumber: "0933333332",
                password: "x",
                userType: "driver",
                status: "active",
            },
        });
        riderId = rider.id;
        driverId = driver.id;

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

        riderSocket = await connectClient(serverUrl, signToken(riderId));
        driverSocket = await connectClient(serverUrl, signToken(driverId));
        await new Promise((r) => setTimeout(r, 80));
    });

    afterAll(async () => {
        riderSocket?.disconnect();
        driverSocket?.disconnect();
        await new Promise((r) => httpServer.close(r));
        if (rideId) {
            await prisma.rideChatMessage.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.rideRequest.deleteMany({ where: { id: rideId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it("subscribe-ride + chat:send emits chat:message and newMessage", async () => {
        const pNew = waitForEvent(driverSocket, "newMessage");
        const pLegacy = waitForEvent(driverSocket, "chat:message");

        driverSocket.emit("subscribe-ride", rideId);
        await new Promise((r) => setTimeout(r, 50));

        riderSocket.emit("chat:send", { rideRequestId: rideId, message: "hello legacy" });

        const [a, b] = await Promise.all([pNew, pLegacy]);
        expect(a).toMatchObject({ message: "hello legacy", rideRequestId: rideId });
        expect(b).toMatchObject({ message: "hello legacy", rideRequestId: rideId });
    });

    it("joinChat + sendMessage emits newMessage", async () => {
        const p = waitForEvent(riderSocket, "newMessage");

        riderSocket.emit("joinChat", { rideRequestId: rideId });
        await new Promise((r) => setTimeout(r, 50));

        driverSocket.emit("sendMessage", { rideRequestId: rideId, message: "hello flutter" });

        const msg = await p;
        expect(msg).toMatchObject({ message: "hello flutter", rideRequestId: rideId });
    });

    it("typing emits userTyping to peer", async () => {
        const p = waitForEvent(riderSocket, "userTyping");

        riderSocket.emit("joinChat", rideId);
        driverSocket.emit("subscribe-ride", rideId);
        await new Promise((r) => setTimeout(r, 50));

        driverSocket.emit("typing", { rideRequestId: rideId });

        const evt = await p;
        expect(evt).toMatchObject({ rideRequestId: rideId, isTyping: true });
    });

    it("messageSeen emits messageSeenUpdated", async () => {
        await prisma.rideChatMessage.updateMany({
            where: { rideRequestId: rideId },
            data: { isRead: false, readAt: null },
        });

        const p = waitForEvent(driverSocket, "messageSeenUpdated");

        driverSocket.emit("subscribe-ride", rideId);
        await new Promise((r) => setTimeout(r, 50));

        riderSocket.emit("messageSeen", { rideRequestId: rideId });

        const evt = await p;
        expect(evt).toMatchObject({ rideRequestId: rideId });
        expect(evt.count).toBeGreaterThan(0);
    });
});
