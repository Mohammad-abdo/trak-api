import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";
import { generateOtp, getOtpExpiresAt } from "../../utils/otpHelper.js";
import { generateToken } from "../../utils/jwtHelper.js";
import { generateUniqueReferralCode } from "./register.js";

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { email, contactNumber, password, loginType = "email" } = req.body;

        console.log("Login attempt:", { email, contactNumber, loginType });

        if (!password && loginType === "email") {
            return res.status(400).json({
                success: false,
                message: "Password is required",
            });
        }

        if (!email && !contactNumber) {
            return res.status(400).json({
                success: false,
                message: "Email or contact number is required",
            });
        }

        // Find user
        const whereClause = {};
        if (email) {
            whereClause.email = email.toLowerCase().trim();
        } else if (contactNumber) {
            whereClause.contactNumber = contactNumber.trim();
        }

        const user = await prisma.user.findFirst({
            where: whereClause,
        });

        if (!user) {
            console.log("User not found with:", whereClause);
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        console.log("User found:", user.email, "Status:", user.status, "Type:", user.userType);

        // Check password if email login
        if (loginType === "email" && user.password) {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                console.log("Password mismatch");
                return res.status(401).json({
                    success: false,
                    message: "Invalid email or password",
                });
            }
        } else if (loginType === "email" && !user.password) {
            return res.status(401).json({
                success: false,
                message: "Password not set for this account",
            });
        }

        // Check if user is active (allow admin to login regardless of status)
        if (user.status !== "active" && user.userType !== "admin") {
            return res.status(403).json({
                success: false,
                message: `Your account is ${user.status}. Please contact support.`,
            });
        }

        if (user.isVerified === false) {
            return res.status(403).json({
                success: false,
                message: "Account not verified. Please verify your account first.",
            });
        }

        // Update last active
        await prisma.user.update({
            where: { id: user.id },
            data: { 
                lastActivedAt: new Date(),
                isOnline: true,
            },
        });

        const token = generateToken(user.id);

        console.log("Login successful for:", user.email);

        res.json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    contactNumber: user.contactNumber,
                    userType: user.userType,
                    status: user.status,
                    isOnline: user.isOnline,
                    isAvailable: user.isAvailable,
                },
            },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Login failed",
        });
    }
};

// @desc    Social login
// @route   POST /api/auth/social-login
// @access  Public
export const socialLogin = async (req, res) => {
    try {
        const { uid, email, firstName, lastName, loginType, displayName } = req.body;

        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    uid ? { uid } : {},
                    email ? { email: email?.toLowerCase() } : {},
                ].filter((obj) => Object.keys(obj).length > 0),
            },
        });

        if (user) {
            if (user.isVerified === false) {
                return res.status(403).json({
                    success: false,
                    message: "Account not verified. Please verify your account first.",
                });
            }
            // Update user info
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    uid,
                    loginType,
                    lastActivedAt: new Date(),
                },
            });
        } else {
            // Generate referral code
            const referralCode = await generateUniqueReferralCode();

            const otp = generateOtp();
            const otpExpiresAt = getOtpExpiresAt();
            // Create new user (unverified until phone/OTP verification if required)
            user = await prisma.user.create({
                data: {
                    uid,
                    email: email?.toLowerCase(),
                    firstName,
                    lastName,
                    displayName,
                    loginType,
                    userType: "rider",
                    status: "active",
                    referralCode,
                    otp,
                    otpExpiresAt,
                    isVerified: false,
                },
            });

            // Create wallet
            await prisma.wallet.create({
                data: {
                    userId: user.id,
                    balance: 0,
                },
            });
        }

        const token = generateToken(user.id);

        res.json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    userType: user.userType,
                    status: user.status,
                },
            },
        });
    } catch (error) {
        console.error("Social login error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Social login failed",
        });
    }
};

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res) => {
    try {
        // Update user status
        await prisma.user.update({
            where: { id: req.user.id },
            data: {
                isOnline: false,
                isAvailable: false,
            },
        });

        res.json({
            success: true,
            message: "Logout successful",
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Logout failed",
        });
    }
};
