import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    rideRequest: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
    },
    user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
    },
    rideRequestRating: {
        create: vi.fn(),
    },
};

vi.mock("../utils/prisma.js", () => ({
    default: prismaMock,
}));

const {
    getNearDrivers,
    acceptDriver,
    cancelTrip,
    rateDriver,
} = await import("../controllers/user/mobileOfferController.js");

function makeRes() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

describe("Mobile offer validation safety", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects near-drivers request with invalid coordinates", async () => {
        const req = {
            body: {
                booking_id: "12",
                booking_location: { lat: 95, lng: 31.2 },
            },
        };
        const res = makeRes();

        await getNearDrivers(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            message: "booking_location (lat/lng) and booking_id are required",
        });
        expect(prismaMock.rideRequest.findUnique).not.toHaveBeenCalled();
    });

    it("rejects accept-driver request with non-numeric driver_id", async () => {
        const req = {
            user: { id: 7 },
            body: {
                driver_id: "abc",
                booking_id: "12",
            },
        };
        const res = makeRes();

        await acceptDriver(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            message: "driver_id and booking_id are required",
        });
        expect(prismaMock.rideRequest.findFirst).not.toHaveBeenCalled();
    });

    it("rejects cancel-trip request with invalid optional driver_id", async () => {
        const req = {
            user: { id: 7 },
            body: {
                driver_id: "x1",
                booking_id: "12",
            },
        };
        const res = makeRes();

        await cancelTrip(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            message: "Invalid driver_id",
        });
        expect(prismaMock.rideRequest.findFirst).not.toHaveBeenCalled();
    });

    it("rejects rate-driver request with non-numeric rate", async () => {
        const req = {
            user: { id: 7 },
            body: {
                driver_id: 22,
                booking_id: "12",
                rate: "five",
                text: "great",
            },
        };
        const res = makeRes();

        await rateDriver(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            message: "Rate must be between 1 and 5",
        });
        expect(prismaMock.rideRequest.findFirst).not.toHaveBeenCalled();
    });
});

