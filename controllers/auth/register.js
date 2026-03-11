import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";
import { generateOtp, getOtpExpiresAt } from "../../utils/otpHelper.js";
import { sendOtpSms } from "../../utils/smsService.js";
import { generateToken } from "../../utils/jwtHelper.js";
import { saveAdminNotification } from "../../utils/notificationService.js";

// Generate unique referral code
export const generateUniqueReferralCode = async () => {
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

        saveAdminNotification("new_driver", {
            title: "New Driver Registration",
            titleAr: "تسجيل سائق جديد",
            message: `${driver.firstName} ${driver.lastName || ''} registered and is pending approval.`,
            messageAr: `${driver.firstName} ${driver.lastName || ''} سجّل حساب جديد وينتظر الموافقة.`,
            link: `/drivers/${driver.id}`,
        }).catch(() => {});

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
