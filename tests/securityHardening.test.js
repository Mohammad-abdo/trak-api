import { describe, it, expect, vi } from "vitest";
import { createIpRateLimiter, securityHeaders } from "../middleware/securityHardening.js";

function makeReq(ip = "1.2.3.4") {
    return {
        clientIp: ip,
        headers: {},
        ip,
    };
}

function makeRes() {
    return {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(name, value) {
            this.headers[name] = value;
        },
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

describe("securityHeaders middleware", () => {
    it("sets expected hardening headers", () => {
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        securityHeaders(req, res, next);

        expect(next).toHaveBeenCalledOnce();
        expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
        expect(res.headers["X-Frame-Options"]).toBe("DENY");
        expect(res.headers["Referrer-Policy"]).toBe("no-referrer");
        expect(res.headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    });
});

describe("createIpRateLimiter middleware", () => {
    it("allows requests under threshold", () => {
        const limiter = createIpRateLimiter({ enabled: true, windowMs: 1000, maxRequests: 2 });
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        limiter(req, res, next);
        limiter(req, res, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(res.statusCode).toBe(200);
    });

    it("returns 429 above threshold", () => {
        const limiter = createIpRateLimiter({ enabled: true, windowMs: 60_000, maxRequests: 1 });
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        limiter(req, res, next);
        limiter(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(429);
        expect(res.body).toMatchObject({
            success: false,
            message: "Too many requests, please try again shortly.",
        });
        expect(Number(res.headers["Retry-After"])).toBeGreaterThan(0);
    });

    it("is a no-op when disabled", () => {
        const limiter = createIpRateLimiter({ enabled: false, windowMs: 1000, maxRequests: 1 });
        const req = makeReq();
        const res = makeRes();
        const next = vi.fn();

        limiter(req, res, next);
        limiter(req, res, next);

        expect(next).toHaveBeenCalledTimes(2);
        expect(res.statusCode).toBe(200);
    });
});

