/**
 * Generate a random 6-digit OTP (no hardcoded values).
 * @returns {string} 6-digit OTP
 */
export const generateOtp = () => {
    const min = 100000;
    const max = 999999;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

/** OTP validity in minutes */
const OTP_EXPIRY_MINUTES = 5;

/**
 * Get expiry time for OTP (e.g. 5 minutes from now).
 * @returns {Date}
 */
export const getOtpExpiresAt = () => {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
};
