import { getTestOtpValue } from "../utils/otpHelper.js";

/**
 * @param {unknown} otpFromBody
 * @returns {string} trimmed string (may be empty)
 */
export function normalizeOtpInput(otpFromBody) {
    if (otpFromBody == null) return "";
    return String(otpFromBody).trim();
}

/**
 * @param {{ otp?: string | null, otpExpiresAt?: Date | null }} user - Prisma user row
 * @param {string} submittedOtp - already normalized
 * @param {{ allowTestOtp: boolean }} options
 * @returns {{ ok: true } | { ok: false, reason: 'missing' | 'invalid' | 'expired' }}
 */
export function validateOtpAgainstUser(user, submittedOtp, options) {
    const { allowTestOtp } = options;

    if (!submittedOtp) {
        return { ok: false, reason: "missing" };
    }

    const storedOtp = user.otp ? String(user.otp).trim() : "";
    const testOtp = allowTestOtp ? getTestOtpValue() : null;

    const matchesTest = !!(testOtp && submittedOtp === testOtp);
    const matchesStored = !!(storedOtp && submittedOtp === storedOtp);

    if (!matchesTest && !matchesStored) {
        return { ok: false, reason: "invalid" };
    }

    // Dev shortcut: when test OTP env is set (mobile paths), skip expiry for any accepted code — preserve legacy behavior
    if (allowTestOtp && testOtp) {
        return { ok: true };
    }

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
        return { ok: false, reason: "expired" };
    }

    return { ok: true };
}
