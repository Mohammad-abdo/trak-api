/**
 * Rider reject offer via POST /offers/cancel-driver-offer
 * Skip: SKIP_CANCEL_OFFER_WS=1
 */

import http from "http";
import express from "express";
import { Server as SocketIoServer } from "socket.io";
import { io as ioClient } from "socket.io-client";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../utils/prisma.js";
import mobileUserRoutes from "../routes/user/mobileUserRoutes.js";
import { parseRejectedBidDriverIds } from "../services/driverOfferRejectService.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_here";
const RIDER_EMAIL = "cdr_reject_rider@test.local";
const DRIVER_A_EMAIL = "cdr_reject_driver_a@test.local";
const DRIVER_B_EMAIL = "cdr_reject_driver_b@test.local";

function signToken(userId) {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "2h" });
}

function waitForEvent(socket, event, ms = 6000) {
    return new Promise((resolve, reject) => {
        const tid = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);
        socket.once(event, (data) => {
            clearTimeout(tid);
            resolve(data);
        });
    });
}

async function cancelOffer(baseUrl, token, bookingId, driverId) {
    return fetch(`${baseUrl}/apimobile/user/offers/cancel-driver-offer`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ booking_id: bookingId, driver_id: driverId }),
    });
}

async function nearDrivers(baseUrl, token, bookingId) {
    return fetch(`${baseUrl}/apimobile/user/offers/near-drivers`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ booking_id: bookingId }),
    });
}

describe.skipIf(process.env.SKIP_CANCEL_OFFER_WS === "1")("cancel-driver-offer — reject offer", () => {
    let httpServer;
    let io;
    let app;
    let baseUrl;
    let riderToken;
    let riderId;
    let driverAId;
    let driverBId;
    let driverSocket;
    let riderSocket;
    const rideIds = [];

    beforeAll(async () => {
        await prisma.$queryRaw`SELECT 1`;

        app = express();
        app.use(express.json());
        httpServer = http.createServer(app);
        io = new SocketIoServer(httpServer, { cors: { origin: "*" }, transports: ["websocket"] });

        io.on("connection", (socket) => {
            const token = socket.handshake?.auth?.token;
            if (!token) return;
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                socket.data.user = { id: decoded.id };
            } catch (_) {}
            socket.on("join-user-room", (userId) => socket.join(`user-${userId}`));
            socket.on("join-driver-room", (driverId) => socket.join(`driver-${driverId}`));
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
                firstName: "CDR",
                lastName: "Rider",
                email: RIDER_EMAIL,
                contactNumber: "0966666601",
                password: "x",
                userType: "rider",
                status: "active",
            },
        });
        const driverA = await prisma.user.upsert({
            where: { email: DRIVER_A_EMAIL },
            update: { status: "active", userType: "driver" },
            create: {
                firstName: "CDR",
                lastName: "DriverA",
                email: DRIVER_A_EMAIL,
                contactNumber: "0966666602",
                password: "x",
                userType: "driver",
                status: "active",
            },
        });
        const driverB = await prisma.user.upsert({
            where: { email: DRIVER_B_EMAIL },
            update: { status: "active", userType: "driver" },
            create: {
                firstName: "CDR",
                lastName: "DriverB",
                email: DRIVER_B_EMAIL,
                contactNumber: "0966666603",
                password: "x",
                userType: "driver",
                status: "active",
            },
        });

        riderId = rider.id;
        driverAId = driverA.id;
        driverBId = driverB.id;
        riderToken = signToken(riderId);

        const connectSocket = (token, joinEvent, roomId) =>
            new Promise((resolve, reject) => {
                const s = ioClient(baseUrl, {
                    auth: { token },
                    transports: ["websocket"],
                    forceNew: true,
                });
                const tid = setTimeout(() => reject(new Error("connect timeout")), 8000);
                s.on("connect", () => {
                    clearTimeout(tid);
                    if (joinEvent) s.emit(joinEvent, roomId);
                    resolve(s);
                });
                s.on("connect_error", reject);
            });

        driverSocket = await connectSocket(signToken(driverAId), "join-driver-room", driverAId);
        riderSocket = await connectSocket(riderToken, "join-user-room", riderId);
        await new Promise((r) => setTimeout(r, 150));
    });

    afterAll(async () => {
        driverSocket?.disconnect();
        riderSocket?.disconnect();
        await new Promise((r) => httpServer.close(r));
        if (rideIds.length) {
            await prisma.rideRequestBid.deleteMany({ where: { rideRequestId: { in: rideIds } } }).catch(() => {});
            await prisma.rideRequest.deleteMany({ where: { id: { in: rideIds } } }).catch(() => {});
        }
        await prisma.$disconnect();
    });

    it("pending + bid: 200, hides driver from near-drivers, emits driver-offer-rejected", async () => {
        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                status: "pending",
                startAddress: "A",
                endAddress: "B",
                totalAmount: 25,
            },
        });
        rideIds.push(ride.id);

        await prisma.rideRequestBid.create({
            data: { rideRequestId: ride.id, driverId: driverAId, bidAmount: 22 },
        });

        const driverEvt = waitForEvent(driverSocket, "driver-offer-rejected");
        const res = await cancelOffer(baseUrl, riderToken, ride.id, driverAId);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.branch).toBe("pending_bid");

        const evt = await driverEvt;
        expect(evt).toMatchObject({
            rideRequestId: ride.id,
            driverId: driverAId,
            riderId,
            rejectedBy: "rider",
        });

        const updated = await prisma.rideRequest.findUnique({
            where: { id: ride.id },
            select: { rejectedBidDriverIds: true, status: true },
        });
        expect(updated.status).toBe("pending");
        expect(parseRejectedBidDriverIds(updated.rejectedBidDriverIds)).toContain(driverAId);

        const near = await nearDrivers(baseUrl, riderToken, ride.id);
        const nearBody = await near.json();
        expect(nearBody.data.map((d) => d.id)).not.toContain(driverAId);
    });

    it("negotiating: clears driver and emits ride-negotiation-rejected", async () => {
        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                driverId: driverAId,
                status: "negotiating",
                negotiationStatus: "pending",
                negotiatedFare: 30,
                startAddress: "A",
                endAddress: "B",
                totalAmount: 25,
            },
        });
        rideIds.push(ride.id);

        const negEvt = waitForEvent(driverSocket, "ride-negotiation-rejected");
        const res = await cancelOffer(baseUrl, riderToken, ride.id, driverAId);
        expect(res.status).toBe(200);

        const evt = await negEvt;
        expect(evt.rejectedBy).toBe("rider");

        const updated = await prisma.rideRequest.findUnique({
            where: { id: ride.id },
            select: { status: true, driverId: true, negotiationStatus: true },
        });
        expect(updated.status).toBe("pending");
        expect(updated.driverId).toBeNull();
        expect(updated.negotiationStatus).toBe("none");
    });

    it("accepted: unassigns driver (regression)", async () => {
        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                driverId: driverAId,
                status: "accepted",
                otp: "123456",
                startAddress: "A",
                endAddress: "B",
                totalAmount: 25,
            },
        });
        rideIds.push(ride.id);

        const cancelledEvt = waitForEvent(driverSocket, "driver-offer-cancelled");
        const res = await cancelOffer(baseUrl, riderToken, ride.id, driverAId);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.status).toBe("pending");
        expect(body.data.branch).toBe("accepted");

        await cancelledEvt;

        const updated = await prisma.rideRequest.findUnique({
            where: { id: ride.id },
            select: { status: true, driverId: true },
        });
        expect(updated.status).toBe("pending");
        expect(updated.driverId).toBeNull();
    });

    it("accepted wrong driver: 400 DRIVER_NOT_ON_BOOKING", async () => {
        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                driverId: driverAId,
                status: "accepted",
                startAddress: "A",
                endAddress: "B",
                totalAmount: 25,
            },
        });
        rideIds.push(ride.id);

        const res = await cancelOffer(baseUrl, riderToken, ride.id, driverBId);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.code).toBe("DRIVER_NOT_ON_BOOKING");
    });

    it("idempotent second reject on pending bid", async () => {
        const ride = await prisma.rideRequest.create({
            data: {
                riderId,
                status: "pending",
                rejectedBidDriverIds: [driverAId],
                startAddress: "A",
                endAddress: "B",
                totalAmount: 25,
            },
        });
        rideIds.push(ride.id);

        const res = await cancelOffer(baseUrl, riderToken, ride.id, driverAId);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.alreadyRejected).toBe(true);
    });
});
