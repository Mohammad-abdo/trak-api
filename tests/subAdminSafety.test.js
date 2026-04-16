import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    user: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    userRole: {
        deleteMany: vi.fn(),
        create: vi.fn(),
    },
};

vi.mock("../utils/prisma.js", () => ({
    default: prismaMock,
}));

vi.mock("bcryptjs", () => ({
    default: {
        hash: vi.fn(async () => "hashed-password"),
    },
}));

const { createSubAdmin, updateSubAdmin } = await import("../controllers/subAdminController.js");

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

describe("Sub-admin safety", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("normalizes unsupported userType to sub_admin on create", async () => {
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({
            id: 1,
            firstName: "A",
            lastName: "B",
            email: "a@test.com",
            contactNumber: "0123",
            countryCode: "+1",
            userType: "sub_admin",
            status: "active",
            lastActivedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            userRoles: [],
        });

        const req = {
            body: {
                firstName: "A",
                lastName: "B",
                email: "a@test.com",
                password: "123456",
                contactNumber: "0123",
                countryCode: "+1",
                userType: "manager",
            },
        };
        const res = makeRes();

        await createSubAdmin(req, res);

        expect(prismaMock.user.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    userType: "sub_admin",
                }),
            })
        );
        expect(res.statusCode).toBe(201);
    });

    it("normalizes unsupported existing staff type on update", async () => {
        prismaMock.user.findUnique
            .mockResolvedValueOnce({ id: 7, userType: "manager" })
            .mockResolvedValueOnce({
                id: 7,
                firstName: "A",
                lastName: "B",
                email: "a@test.com",
                contactNumber: "0123",
                countryCode: "+1",
                userType: "sub_admin",
                status: "active",
                lastActivedAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                userRoles: [],
            });
        prismaMock.user.update.mockResolvedValue({});
        prismaMock.userRole.deleteMany.mockResolvedValue({});

        const req = {
            params: { id: "7" },
            body: {
                firstName: "A",
                lastName: "B",
                email: "a@test.com",
                contactNumber: "0123",
                countryCode: "+1",
            },
        };
        const res = makeRes();

        await updateSubAdmin(req, res);

        expect(prismaMock.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 7 },
                data: expect.objectContaining({
                    userType: "sub_admin",
                }),
            })
        );
        expect(res.statusCode).toBe(200);
    });
});

