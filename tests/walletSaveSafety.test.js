import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    wallet: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    walletHistory: {
        create: vi.fn(),
    },
};

const userHasAnyPermissionMock = vi.fn();

vi.mock("../utils/prisma.js", () => ({
    default: prismaMock,
}));

vi.mock("../utils/staffPermissions.js", () => ({
    userHasAnyPermission: userHasAnyPermissionMock,
}));

const { saveWallet } = await import("../controllers/wallet/transactions.js");

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

describe("Wallet save safety", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("blocks non-staff users from save-wallet", async () => {
        const req = {
            user: { id: 101, userType: "rider" },
            body: { amount: 50 },
        };
        const res = makeRes();

        await saveWallet(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body).toMatchObject({
            success: false,
            message: "Access denied. Insufficient permissions for this resource.",
        });
        expect(prismaMock.wallet.findUnique).not.toHaveBeenCalled();
    });

    it("blocks sub_admin without wallets.manage permission", async () => {
        userHasAnyPermissionMock.mockResolvedValue(false);
        const req = {
            user: { id: 201, userType: "sub_admin" },
            body: { amount: 20 },
        };
        const res = makeRes();

        await saveWallet(req, res);

        expect(userHasAnyPermissionMock).toHaveBeenCalledWith(201, "sub_admin", ["wallets.manage"]);
        expect(res.statusCode).toBe(403);
        expect(prismaMock.wallet.findUnique).not.toHaveBeenCalled();
    });

    it("allows admin and updates wallet as before", async () => {
        const req = {
            user: { id: 301, userType: "admin" },
            body: { amount: 25 },
        };
        const res = makeRes();

        prismaMock.wallet.findUnique.mockResolvedValue({ id: 11, userId: 301, balance: 100 });
        prismaMock.wallet.update.mockResolvedValue({ id: 11, userId: 301, balance: 125 });
        prismaMock.walletHistory.create.mockResolvedValue({});

        await saveWallet(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            success: true,
            message: "Wallet updated successfully",
            data: { id: 11, userId: 301, balance: 125 },
        });
        expect(prismaMock.walletHistory.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    transactionType: "admin_adjustment",
                }),
            })
        );
    });
});

