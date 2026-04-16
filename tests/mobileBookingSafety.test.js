import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    vehicleCategory: { findUnique: vi.fn() },
    pricingRule: { findFirst: vi.fn() },
    shipmentSize: { findFirst: vi.fn() },
    shipmentWeight: { findFirst: vi.fn() },
    rideRequest: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    rideRequestRating: { groupBy: vi.fn() },
};

vi.mock("../utils/prisma.js", () => ({
    default: prismaMock,
}));

const { createBooking } = await import("../controllers/user/mobileBookingController.js");
const { getMyBookings } = await import("../controllers/user/mobileUserBookingController.js");

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

describe("Mobile booking safety contracts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("createBooking keeps legacy fields and applies server-side pricing", async () => {
        prismaMock.vehicleCategory.findUnique.mockResolvedValue({
            id: 7,
            name: "Mini Van",
            nameAr: "ميني فان",
            serviceCategoryId: 3,
            serviceCategory: { id: 3, name: "Cargo", nameAr: "شحن" },
        });
        prismaMock.pricingRule.findFirst.mockResolvedValue({
            baseFare: 40,
            minimumFare: 30,
            perDistanceAfterBase: 4,
            perMinuteDrive: 1,
        });
        prismaMock.shipmentSize.findFirst.mockResolvedValue({ id: 11, priceModifier: 7 });
        prismaMock.shipmentWeight.findFirst.mockResolvedValue({ id: 13, priceModifier: 5 });
        prismaMock.rideRequest.create.mockResolvedValue({
            id: 99,
            status: "pending",
            totalAmount: 52,
            baseFare: 40,
            minimumFare: 30,
            perDistance: 4,
            perMinuteDrive: 1,
            vehicleCategoryId: 7,
            serviceId: 3,
            paymentType: "cash",
            otp: "1234",
            startLatitude: "30.1",
            startLongitude: "31.2",
            startAddress: "A",
            endLatitude: "30.2",
            endLongitude: "31.3",
            endAddress: "B",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
        });

        const req = {
            user: { id: 501 },
            body: {
                vehicle_id: 7,
                shipmentSize_id: 11,
                shipmentWeight_id: 13,
                paymentMethod: "cash",
                from: { lat: 30.1, lng: 31.2, address: "A" },
                to: { lat: 30.2, lng: 31.3, address: "B" },
                totalPrice: 9999,
            },
        };
        const res = makeRes();

        await createBooking(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toMatchObject({
            booking_id: 99,
            totalAmount: 52,
            paymentType: "cash",
            tripOtp: "1234",
        });
        expect(res.body.data.vehicleCategory).toMatchObject({ id: 7, name: "Mini Van" });
        expect(res.body.data.pricing).toMatchObject({
            baseFare: 40,
            shipmentSizeModifier: 7,
            shipmentWeightModifier: 5,
            totalAmount: 52,
        });
        expect(prismaMock.rideRequest.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    serviceId: 3,
                    totalAmount: 52,
                }),
            })
        );
    });

    it("getMyBookings keeps existing keys and adds pricing/category safely", async () => {
        prismaMock.rideRequest.findMany.mockResolvedValue([
            {
                id: 10,
                status: "pending",
                totalAmount: 55,
                baseFare: 40,
                minimumFare: 30,
                perDistance: 4,
                perMinuteDrive: 1,
                vehicleCategoryId: 7,
                paymentType: "cash",
                startAddress: "A",
                endAddress: "B",
                startLatitude: "30.1",
                startLongitude: "31.2",
                endLatitude: "30.2",
                endLongitude: "31.3",
                otp: "1234",
                isDriverRated: false,
                serviceData: { vehicleCategoryId: 7, vehicleCategoryName: "Mini Van" },
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                driver: null,
                service: { id: 3, name: "Cargo", nameAr: "شحن" },
                ratings: [],
            },
        ]);
        prismaMock.rideRequest.count.mockResolvedValue(1);
        prismaMock.rideRequestRating.groupBy.mockResolvedValue([]);

        const req = {
            user: { id: 501 },
            query: {},
            protocol: "http",
            get: () => "localhost:5000",
        };
        const res = makeRes();

        await getMyBookings(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.bookings).toHaveLength(1);
        const row = res.body.data.bookings[0];
        expect(row).toMatchObject({
            book_id: 10,
            totalAmount: 55,
            tripOtp: "1234",
            paymentType: "cash",
            service: { id: 3, name: "Cargo" },
        });
        expect(row.vehicleCategory).toMatchObject({ id: 7, name: "Mini Van" });
        expect(row.pricing).toMatchObject({ baseFare: 40, totalAmount: 55 });
    });
});

