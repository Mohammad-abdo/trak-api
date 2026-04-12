import { describe, it, expect } from "vitest";
import { normalizeOtpInput, validateOtpAgainstUser } from "../services/otpVerificationService.js";

describe("normalizeOtpInput", () => {
    it("trims string OTP", () => {
        expect(normalizeOtpInput("  123456  ")).toBe("123456");
    });

    it("stringifies numbers", () => {
        expect(normalizeOtpInput(123456)).toBe("123456");
    });

    it("returns empty for null", () => {
        expect(normalizeOtpInput(null)).toBe("");
    });
});

describe("validateOtpAgainstUser (allowTestOtp: false)", () => {
    it("rejects wrong OTP", () => {
        const user = { otp: "111111", otpExpiresAt: new Date(Date.now() + 60_000) };
        const v = validateOtpAgainstUser(user, "999999", { allowTestOtp: false });
        expect(v.ok).toBe(false);
        expect(v.reason).toBe("invalid");
    });

    it("accepts matching non-expired OTP", () => {
        const user = { otp: "111111", otpExpiresAt: new Date(Date.now() + 60_000) };
        const v = validateOtpAgainstUser(user, "111111", { allowTestOtp: false });
        expect(v.ok).toBe(true);
    });

    it("rejects expired stored OTP", () => {
        const user = { otp: "111111", otpExpiresAt: new Date(Date.now() - 60_000) };
        const v = validateOtpAgainstUser(user, "111111", { allowTestOtp: false });
        expect(v.ok).toBe(false);
        expect(v.reason).toBe("expired");
    });
});
