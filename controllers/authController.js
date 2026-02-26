import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";
import { generateOtp, getOtpExpiresAt } from "../utils/otpHelper.js";
import { sendOtpSms } from "../utils/smsService.js";

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || "your_jwt_secret_key_here", {
        expiresIn: process.env.JWT_EXPIRE || "7d",
    });
};

// Generate unique referral code
const generateUniqueReferralCode = async () => {
    const generateCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    let code;
    let isUnique = false;

    while (!isUnique) {
        code = generateCode();
        const existing = await prisma.user.findUnique({
            where: { referralCode: code },
        });
        if (!existing) isUnique = true;
    }

    return code;
};

// @desc    Register rider
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            countryCode,
            userType = "rider",
        } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.toLowerCase() } : {},
                    contactNumber ? { contactNumber } : {},
                ].filter((obj) => Object.keys(obj).length > 0),
            },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email or contact number",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate referral code
        const referralCode = await generateUniqueReferralCode();

        const otp = generateOtp();
        const otpExpiresAt = getOtpExpiresAt();

        // Create user
        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email?.toLowerCase(),
                password: hashedPassword,
                contactNumber,
                countryCode: countryCode || "+1",
                userType,
                referralCode,
                status: "active",
                otp,
                otpExpiresAt,
                isVerified: false,
            },
        });

        if (contactNumber) {
            await sendOtpSms(contactNumber, otp);
        }

        // Create wallet for rider
        await prisma.wallet.create({
            data: {
                userId: user.id,
                balance: 0,
            },
        });

        const token = generateToken(user.id);

        res.status(201).json({
            success: true,
            message: "Registration successful",
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
                },
            },
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Registration failed",
        });
    }
};

// @desc    Register driver
// @route   POST /api/auth/driver-register
// @access  Public
export const driverRegister = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            countryCode,
            serviceId,
            fleetId,
        } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.toLowerCase() } : {},
                    contactNumber ? { contactNumber } : {},
                ].filter((obj) => Object.keys(obj).length > 0),
            },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Driver already exists with this email or contact number",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate referral code
        const referralCode = await generateUniqueReferralCode();

        const otp = generateOtp();
        const otpExpiresAt = getOtpExpiresAt();

        // Create driver
        const driver = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email?.toLowerCase(),
                password: hashedPassword,
                contactNumber,
                countryCode: countryCode || "+1",
                userType: "driver",
                serviceId,
                fleetId,
                status: "pending", // Drivers need approval
                referralCode,
                otp,
                otpExpiresAt,
                isVerified: false,
            },
        });

        if (contactNumber) {
            await sendOtpSms(contactNumber, otp);
        }

        // Create wallet for driver
        await prisma.wallet.create({
            data: {
                userId: driver.id,
                balance: 0,
            },
        });

        const token = generateToken(driver.id);

        res.status(201).json({
            success: true,
            message: "Driver registration successful. Waiting for approval.",
            data: {
                token,
                user: {
                    id: driver.id,
                    firstName: driver.firstName,
                    lastName: driver.lastName,
                    email: driver.email,
                    contactNumber: driver.contactNumber,
                    userType: driver.userType,
                    status: driver.status,
                },
            },
        });
    } catch (error) {
        console.error("Driver registration error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Driver registration failed",
        });
    }
};

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

// @desc    Verify OTP and set isVerified (authenticated user)
// @route   POST /api/auth/submit-otp
// @access  Private
export const submitOtp = async (req, res) => {
    try {
        const userId = req.user.id;
        const { otp } = req.body;

        if (!otp) {
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

        if (user.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP",
            });
        }

        if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired",
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
