import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
    wallet: {
        findFirst: vi.fn(),
        update: vi.fn(),
    },
    walletHistory: {
        findFirst: vi.fn(),
        create: vi.fn(),
    },
    $transaction: vi.fn(),
};

const verifyPayskySecureHashMock = vi.fn();

vi.mock("../utils/prisma.js", () => ({
    default: prismaMock,
}));

vi.mock("../utils/payskySecureHash.js", () => ({
    verifyPayskySecureHash: verifyPayskySecureHashMock,
}));

const { confirmWalletTopup } = await import("../controllers/wallet/walletTopupController.js");

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

function makeSignedBody(overrides = {}) {
    return {
        merchantReference: "TOPUP:10:1700000000000",
        amount: 50,
        Amount: "5000",
        Currency: "818",
        DateTimeLocalTrxn: "202601011230",
        MerchantId: "m1",
        TerminalId: "t1",
        SecureHash: "ABCDEF",
        ...overrides,
    };
}

describe("Wallet topup confirm safety", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.PAYSKY_SECRET_KEY_HEX = "AA11";
        process.env.PAYSKY_MERCHANT_ID = "m1";
        process.env.PAYSKY_TERMINAL_ID = "t1";
        process.env.PAYSKY_MERCHANT_CURRENCY_NUMERIC = "818";
        process.env.PAYSKY_AMOUNT_MINOR_DIVISOR = "100";
    });

    it("rejects missing signed fields", async () => {
        const req = {
            user: { id: 5 },
            body: {
                merchantReference: "TOPUP:10:1700000000000",
                amount: 50,
            },
        };
        const res = makeRes();

        await confirmWalletTopup(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toMatchObject({
            success: false,
            message: "Signed PaySky confirmation fields are required",
        });
        expect(prismaMock.wallet.findFirst).not.toHaveBeenCalled();
    });

    it("rejects invalid signature", async () => {
        verifyPayskySecureHashMock.mockReturnValue(false);
        const req = {
            user: { id: 5 },
            body: makeSignedBody(),
        };
        const res = makeRes();

        await confirmWalletTopup(req, res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toMatchObject({
            success: false,
            message: "Invalid PaySky signature",
        });
        expect(prismaMock.wallet.findFirst).not.toHaveBeenCalled();
    });

    it("credits wallet only after valid signed confirmation", async () => {
        verifyPayskySecureHashMock.mockReturnValue(true);
        prismaMock.wallet.findFirst.mockResolvedValue({ id: 10, userId: 5, balance: 100 });
        prismaMock.walletHistory.findFirst.mockResolvedValue(null);
        prismaMock.wallet.update.mockResolvedValue({ id: 10, userId: 5, balance: 150 });
        prismaMock.walletHistory.create.mockResolvedValue({});
        prismaMock.$transaction.mockImplementation(async (ops) => Promise.all(ops));

        const req = {
            user: { id: 5 },
            body: makeSignedBody(),
        };
        const res = makeRes();

        await confirmWalletTopup(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            success: true,
            message: "Wallet topped up successfully",
            data: {
                newBalance: 150,
                topupAmount: 50,
            },
        });
        expect(prismaMock.wallet.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: { balance: 150 },
        });
    });
});

