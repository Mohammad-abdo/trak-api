/** Fixed OTP for testing when TEST_OTP=1 or NODE_ENV !== 'production' */
const TEST_OTP_VALUE = '123456';

const isTestOtpMode = () =>
    process.env.TEST_OTP === '1' || process.env.TEST_OTP === 'true' || process.env.NODE_ENV !== 'production';

/**
 * Generate a random 6-digit OTP (or fixed 123456 in test mode).
 * @returns {string} 6-digit OTP
 */
export const generateOtp = () => {
    if (isTestOtpMode()) return TEST_OTP_VALUE;
    const min = 100000;
    const max = 999999;
    return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

/** For submit-otp: in test mode this OTP is always accepted */
export const getTestOtpValue = () => (isTestOtpMode() ? TEST_OTP_VALUE : null);

/** OTP validity in minutes */
const OTP_EXPIRY_MINUTES = 5;

/**
 * Get expiry time for OTP (e.g. 5 minutes from now).
 * @returns {Date}
 */
export const getOtpExpiresAt = () => {
    return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
};
