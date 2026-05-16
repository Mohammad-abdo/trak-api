/**
 * Trip tracking Socket.IO — Flutter + legacy event names.
 * Skip: SKIP_RIDE_TRACKING_WS=1
 */

import http from "http";
import express from "express";
import { Server as SocketIoServer } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import { subscribeSocketToRide } from "../utils/rideSocketRooms.js";
import { registerRideTrackingHandlers } from "../utils/rideTrackingSocket.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";
const RIDER_EMAIL = "rt_flutter_rider@test.local";
const DRIVER_EMAIL = "rt_flutter_driver@test.local";

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

describe.skipIf(process.env.SKIP_RIDE_TRACKING_WS === "1")("Ride tracking socket — Flutter + legacy", () => {
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
            socket.on("joinTracking", async (payload) => {
                await subscribeSocketToRide(socket, payload, { socketAuthEnforced, io });
            });

            registerRideTrackingHandlers(socket, io);
        });

        await new Promise((resolve) => httpServer.listen(0, resolve));
        const { port } = httpServer.address();
        serverUrl = `http://127.0.0.1:${port}`;

        const rider = await prisma.user.upsert({
            where: { email: RIDER_EMAIL },
            update: { status: "active", userType: "rider" },
            create: {
                firstName: "RT",
                lastName: "Rider",
                email: RIDER_EMAIL,
                contactNumber: "0944444441",
                password: "x",
                userType: "rider",
                status: "active",
            },
        });
        const driver = await prisma.user.upsert({
            where: { email: DRIVER_EMAIL },
            update: { status: "active", userType: "driver" },
            create: {
                firstName: "RT",
                lastName: "Driver",
                email: DRIVER_EMAIL,
                contactNumber: "0944444442",
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
                totalAmount: 25,
                paymentType: "cash",
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
            await prisma.payment.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.walletHistory.deleteMany({ where: { rideRequestId: rideId } }).catch(() => {});
            await prisma.rideRequest.deleteMany({ where: { id: rideId } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it("updateDriverLocation emits driverLocationUpdated and driver-location-for-ride", async () => {
        const pFlutter = waitForEvent(riderSocket, "driverLocationUpdated");
        const pLegacy = waitForEvent(riderSocket, "driver-location-for-ride");

        riderSocket.emit("joinTracking", { tripId: rideId });
        await new Promise((r) => setTimeout(r, 50));

        driverSocket.emit("updateDriverLocation", {
            tripId: rideId,
            lat: 30.05,
            lng: 31.24,
        });

        const [a, b] = await Promise.all([pFlutter, pLegacy]);
        expect(a).toMatchObject({ tripId: rideId, rideRequestId: rideId });
        expect(b).toMatchObject({ rideRequestId: rideId });
    });

    it("arrivedToPickup emits driverArrived and ride-arrived", async () => {
        const pFlutter = waitForEvent(riderSocket, "driverArrived");
        const pLegacy = waitForEvent(riderSocket, "ride-arrived");

        riderSocket.emit("subscribe-ride", rideId);
        await new Promise((r) => setTimeout(r, 50));

        driverSocket.emit("arrivedToPickup", { tripId: rideId });

        const [a, b] = await Promise.all([pFlutter, pLegacy]);
        expect(a).toMatchObject({ tripId: rideId, status: "arrived" });
        expect(b).toMatchObject({ rideRequestId: rideId, status: "arrived" });
    });

    it("startTrip emits tripStarted and ride-started", async () => {
        const pFlutter = waitForEvent(riderSocket, "tripStarted");
        const pLegacy = waitForEvent(riderSocket, "ride-started");

        riderSocket.emit("subscribe-ride", rideId);
        await new Promise((r) => setTimeout(r, 50));

        driverSocket.emit("startTrip", { rideRequestId: rideId });

        const [a, b] = await Promise.all([pFlutter, pLegacy]);
        expect(a).toMatchObject({ status: "started" });
        expect(b).toMatchObject({ status: "started" });
    });
});
