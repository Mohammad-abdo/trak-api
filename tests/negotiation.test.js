import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import {
    buildApp,
    ensureTestUsers,
    createTestRide,
    setNegotiationEnabled,
    cleanup,
    prisma,
} from "./setup.js";

const app = buildApp();
let rider, driver;
const rideIds = [];

beforeAll(async () => {
    const users = await ensureTestUsers();
    rider = users.rider;
    driver = users.driver;
});

afterAll(async () => {
    await cleanup(rideIds);
    await prisma.$disconnect();
});

// ─── GET /api/negotiations/settings ───────────────────────────────

describe("GET /api/negotiations/settings", () => {
    it("returns settings (no auth required)", async () => {
        await setNegotiationEnabled(true, 20, 3, 90);

        const res = await request(app).get("/api/negotiations/settings");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            enabled: true,
            maxPercent: 20,
            maxRounds: 3,
            timeoutSeconds: 90,
        });
    });

    it("returns enabled=false when feature is off", async () => {
        await setNegotiationEnabled(false);

        const res = await request(app).get("/api/negotiations/settings");

        expect(res.status).toBe(200);
        expect(res.body.data.enabled).toBe(false);
    });
});

// ─── POST /api/negotiations/start ─────────────────────────────────

describe("POST /api/negotiations/start", () => {
    let ride;

    beforeEach(async () => {
        await setNegotiationEnabled(true, 20, 3, 90);
        ride = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(ride.id);
    });

    it("rider starts negotiation with 15% discount", async () => {
        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.negotiationStatus).toBe("pending");
        expect(res.body.data.proposedFare).toBe(85);
        expect(res.body.data.percentChange).toBe(-15);
        expect(res.body.data.round).toBe(1);
        expect(res.body.data.expiresAt).toBeTruthy();
    });

    it("rejects if negotiation disabled", async () => {
        await setNegotiationEnabled(false);

        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/disabled/i);
    });

    it("rejects if proposed fare exceeds max percent", async () => {
        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 70 }); // 30% discount > 20%

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/exceeds/i);
    });

    it("rejects if driver tries to start (only rider can)", async () => {
        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });

        expect(res.status).toBe(403);
    });

    it("rejects without auth token", async () => {
        const res = await request(app)
            .post("/api/negotiations/start")
            .send({ rideRequestId: ride.id, proposedFare: 85 });

        expect(res.status).toBe(401);
    });

    it("rejects missing fields", async () => {
        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    it("allows increase up to 20%", async () => {
        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 120 });

        expect(res.status).toBe(200);
        expect(res.body.data.percentChange).toBe(20);
    });
});

// ─── POST /api/negotiations/counter ───────────────────────────────

describe("POST /api/negotiations/counter", () => {
    let ride;

    beforeEach(async () => {
        await setNegotiationEnabled(true, 20, 3, 90);
        ride = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(ride.id);

        // Start negotiation first
        await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });
    });

    it("driver counters with a different fare", async () => {
        const res = await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 92 });

        expect(res.status).toBe(200);
        expect(res.body.data.negotiationStatus).toBe("counter_offered");
        expect(res.body.data.proposedFare).toBe(92);
        expect(res.body.data.round).toBe(2);
    });

    it("rejects same party countering twice in a row", async () => {
        // Rider already proposed — rider can't counter again
        const res = await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 88 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/wait/i);
    });

    it("rejects when max rounds exceeded", async () => {
        await setNegotiationEnabled(true, 20, 2, 90); // only 2 rounds allowed

        // Round 2: driver counters
        await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 92 });

        // Round 3: rider tries to counter — should fail (max=2)
        const res = await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 88 });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/max/i);
    });

    it("rejects fare exceeding bounds", async () => {
        const res = await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 130 }); // 30% > 20%

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/exceeds/i);
    });
});

// ─── POST /api/negotiations/accept ────────────────────────────────

describe("POST /api/negotiations/accept", () => {
    let ride;

    beforeEach(async () => {
        await setNegotiationEnabled(true, 20, 3, 90);
        ride = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(ride.id);

        await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });
    });

    it("driver accepts the proposed fare", async () => {
        const res = await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id });

        expect(res.status).toBe(200);
        expect(res.body.data.negotiationStatus).toBe("accepted");
        expect(res.body.data.negotiatedFare).toBe(85);
        expect(res.body.data.baseFare).toBe(100);
    });

    it("rider can also accept (after driver counter)", async () => {
        await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 92 });

        const res = await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id });

        expect(res.status).toBe(200);
        expect(res.body.data.negotiatedFare).toBe(92);
    });

    it("rejects accept on ride with no negotiation", async () => {
        const freshRide = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(freshRide.id);

        const res = await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: freshRide.id });

        expect(res.status).toBe(400);
    });

    it("rejects double-accept", async () => {
        await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id });

        const res = await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id });

        expect(res.status).toBe(400);
    });
});

// ─── POST /api/negotiations/reject ────────────────────────────────

describe("POST /api/negotiations/reject", () => {
    let ride;

    beforeEach(async () => {
        await setNegotiationEnabled(true, 20, 3, 90);
        ride = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(ride.id);

        await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });
    });

    it("driver rejects negotiation", async () => {
        const res = await request(app)
            .post("/api/negotiations/reject")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id });

        expect(res.status).toBe(200);
        expect(res.body.data.negotiationStatus).toBe("rejected");
        expect(res.body.data.negotiatedFare).toBeNull();
        expect(res.body.data.baseFare).toBe(100);
    });

    it("rider can also reject their own negotiation", async () => {
        const res = await request(app)
            .post("/api/negotiations/reject")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id });

        expect(res.status).toBe(200);
        expect(res.body.data.negotiationStatus).toBe("rejected");
    });

    it("rejects reject on already-rejected ride", async () => {
        await request(app)
            .post("/api/negotiations/reject")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id });

        const res = await request(app)
            .post("/api/negotiations/reject")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id });

        expect(res.status).toBe(400);
    });
});

// ─── GET /api/negotiations/history/:rideRequestId ─────────────────

describe("GET /api/negotiations/history/:rideRequestId", () => {
    let ride;

    beforeEach(async () => {
        await setNegotiationEnabled(true, 20, 3, 90);
        ride = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(ride.id);
    });

    it("returns empty history for fresh ride", async () => {
        const res = await request(app)
            .get(`/api/negotiations/history/${ride.id}`)
            .set("Authorization", `Bearer ${rider.token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.history).toHaveLength(0);
        expect(res.body.data.ride.negotiationStatus).toBe("none");
    });

    it("returns full history after negotiation flow", async () => {
        // Start
        await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });

        // Counter
        await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 92 });

        // Accept
        await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id });

        const res = await request(app)
            .get(`/api/negotiations/history/${ride.id}`)
            .set("Authorization", `Bearer ${rider.token}`);

        expect(res.status).toBe(200);
        expect(res.body.data.history).toHaveLength(3);
        expect(res.body.data.history[0].action).toBe("propose");
        expect(res.body.data.history[1].action).toBe("counter");
        expect(res.body.data.history[2].action).toBe("accept");
        expect(res.body.data.ride.negotiationStatus).toBe("accepted");
        expect(res.body.data.ride.negotiatedFare).toBe(92);
    });

    it("rejects unauthorized user", async () => {
        // Create a third user not related to this ride
        const otherUser = await prisma.user.upsert({
            where: { email: "other_user_nego@test.com" },
            update: {},
            create: {
                firstName: "Other",
                lastName: "User",
                email: "other_user_nego@test.com",
                contactNumber: "09990003333",
                password: "hashed",
                userType: "rider",
                status: "active",
            },
        });

        const otherToken = (await import("jsonwebtoken")).default.sign(
            { id: otherUser.id },
            process.env.JWT_SECRET || "your_jwt_secret_key_here",
            { expiresIn: "1h" }
        );

        const res = await request(app)
            .get(`/api/negotiations/history/${ride.id}`)
            .set("Authorization", `Bearer ${otherToken}`);

        expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent ride", async () => {
        const res = await request(app)
            .get("/api/negotiations/history/999999")
            .set("Authorization", `Bearer ${rider.token}`);

        expect(res.status).toBe(404);
    });
});

// ─── Full negotiation flow (end-to-end) ───────────────────────────

describe("Full negotiation flow", () => {
    it("complete flow: start → counter → counter → accept", async () => {
        await setNegotiationEnabled(true, 20, 4, 90);
        const ride = await createTestRide(rider.id, driver.id, 200);
        rideIds.push(ride.id);

        // Round 1: rider proposes 170 (15% discount)
        const r1 = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 170 });
        expect(r1.status).toBe(200);
        expect(r1.body.data.round).toBe(1);

        // Round 2: driver counters with 190 (5% discount)
        const r2 = await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 190 });
        expect(r2.status).toBe(200);
        expect(r2.body.data.round).toBe(2);

        // Round 3: rider counters with 180 (10% discount)
        const r3 = await request(app)
            .post("/api/negotiations/counter")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 180 });
        expect(r3.status).toBe(200);
        expect(r3.body.data.round).toBe(3);

        // Driver accepts 180
        const r4 = await request(app)
            .post("/api/negotiations/accept")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id });
        expect(r4.status).toBe(200);
        expect(r4.body.data.negotiatedFare).toBe(180);
        expect(r4.body.data.negotiationStatus).toBe("accepted");
        expect(r4.body.data.percentChange).toBe(-10);

        // Verify history
        const r5 = await request(app)
            .get(`/api/negotiations/history/${ride.id}`)
            .set("Authorization", `Bearer ${rider.token}`);
        expect(r5.body.data.history).toHaveLength(4);
    });

    it("start → reject → rider can start again", async () => {
        await setNegotiationEnabled(true, 20, 3, 90);
        const ride = await createTestRide(rider.id, driver.id, 100);
        rideIds.push(ride.id);

        // Start
        await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 85 });

        // Reject
        await request(app)
            .post("/api/negotiations/reject")
            .set("Authorization", `Bearer ${driver.token}`)
            .send({ rideRequestId: ride.id });

        // Start again after rejection
        const res = await request(app)
            .post("/api/negotiations/start")
            .set("Authorization", `Bearer ${rider.token}`)
            .send({ rideRequestId: ride.id, proposedFare: 90 });

        expect(res.status).toBe(200);
        expect(res.body.data.negotiationStatus).toBe("pending");
        expect(res.body.data.proposedFare).toBe(90);
    });
});
