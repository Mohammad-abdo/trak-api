import { describe, it, expect } from "vitest";
import { mobileLoginPhoneOnlyPolicyError } from "../utils/phoneLookup.js";

describe("mobileLoginPhoneOnlyPolicyError", () => {
    it("returns null for valid phone body", () => {
        expect(mobileLoginPhoneOnlyPolicyError({ phone: "01234567890", password: "x" })).toBeNull();
    });

    it("rejects email without phone", () => {
        const err = mobileLoginPhoneOnlyPolicyError({ email: "a@b.com", password: "x" });
        expect(err?.status).toBe(400);
        expect(err?.message).toMatch(/phone/i);
    });

    it("rejects phone field that looks like email", () => {
        const err = mobileLoginPhoneOnlyPolicyError({ phone: "user@test.com", password: "x" });
        expect(err?.status).toBe(400);
    });

    it("allows phone when email is also present (phone wins)", () => {
        expect(
            mobileLoginPhoneOnlyPolicyError({ phone: "0100", email: "a@b.com", password: "x" }),
        ).toBeNull();
    });
});
