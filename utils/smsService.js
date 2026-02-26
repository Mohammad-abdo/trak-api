/**
 * Send OTP via SMS.
 * Configure with SMS provider (e.g. Twilio) via env; if not configured, logs OTP for development.
 * @param {string} phone - Recipient phone (with country code if needed)
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
export const sendOtpSms = async (phone, otp) => {
    // Optional: use Twilio or other provider when env is set
    // e.g. if (process.env.TWILIO_ACCOUNT_SID) { ... }
    if (process.env.SMS_DISABLED === 'true') {
        console.log('[SMS] OTP (dev):', otp, 'to', phone);
        return { sent: true };
    }
    // Placeholder: integrate your SMS gateway here (Twilio, AWS SNS, etc.)
    console.log('[SMS] OTP would be sent to', phone, '– code:', otp, '(configure SMS gateway for production)');
    return { sent: true };
};
