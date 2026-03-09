import prisma from "../../utils/prisma.js";

// @desc    Forget password
// @route   POST /api/auth/forget-password
// @access  Public
export const forgetPassword = async (req, res) => {
    try {
        const { email, contactNumber } = req.body;

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email?.toLowerCase() } : {},
                    contactNumber ? { contactNumber } : {},
                ].filter((obj) => Object.keys(obj).length > 0),
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // TODO: Send OTP via email/SMS
        // For now, just return success
        res.json({
            success: true,
            message: "OTP sent to your email/phone",
        });
    } catch (error) {
        console.error("Forget password error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to process request",
        });
    }
};
