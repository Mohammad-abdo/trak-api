import prisma from "../../utils/prisma.js";
import { generateOtp, getOtpExpiresAt } from "../../utils/otpHelper.js";
import { sendOtpSms } from "../../utils/smsService.js";
import { normalizeOtpInput, validateOtpAgainstUser } from "../../services/otpVerificationService.js";

// @desc    Verify OTP and set isVerified (authenticated user)
// @route   POST /api/auth/submit-otp
// @access  Private
export const submitOtp = async (req, res) => {
    try {
        const userId = req.user.id;
        const submittedOtp = normalizeOtpInput(req.body?.otp);

        if (!submittedOtp) {
            return res.status(400).json({
                success: false,
                message: "OTP is required",
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const v = validateOtpAgainstUser(user, submittedOtp, { allowTestOtp: false });
        if (!v.ok) {
            const message =
                v.reason === "expired" ? "OTP has expired" : v.reason === "missing" ? "OTP is required" : "Invalid OTP";
            return res.status(400).json({
                success: false,
                message,
            });
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                otp: null,
                otpExpiresAt: null,
                otpVerifyAt: new Date(),
                isVerified: true,
            },
        });

        return res.json({
            success: true,
            message: "Account verified successfully",
        });
    } catch (error) {
        console.error("Submit OTP error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "OTP verification failed",
        });
    }
};

// @desc    Resend OTP by phone (user must exist and not be verified)
// @route   POST /api/auth/resend-otp
// @access  Public
export const resendOtp = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone is required",
            });
        }

        const user = await prisma.user.findFirst({
            where: { contactNumber: phone.trim() },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        if (user.isVerified) {
            return res.status(400).json({
                success: false,
                message: "Account is already verified",
            });
        }

        const otp = generateOtp();
        const otpExpiresAt = getOtpExpiresAt();

        await prisma.user.update({
            where: { id: user.id },
            data: { otp, otpExpiresAt },
        });

        await sendOtpSms(user.contactNumber || phone, otp);

        return res.json({
            success: true,
            message: "OTP sent successfully",
        });
    } catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to resend OTP",
        });
    }
};
