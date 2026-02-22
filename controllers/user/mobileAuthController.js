import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma.js';

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret_key_here', {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};

const fullUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    contactNumber: true,
    countryCode: true,
    userType: true,
    status: true,
    avatar: true,
    gender: true,
    address: true,
    latitude: true,
    longitude: true,
    isOnline: true,
    isAvailable: true,
    referralCode: true,
    createdAt: true,
};

// @desc    Login with phone + password
// @route   POST /apimobile/user/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ success: false, message: 'Phone and password are required' });
        }

        const user = await prisma.user.findFirst({
            where: { contactNumber: phone.trim() },
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid phone or password' });
        }

        if (!user.password) {
            return res.status(401).json({ success: false, message: 'Password not set for this account' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid phone or password' });
        }

        const blockedStatuses = ['inactive', 'banned', 'deleted', 'suspended'];
        if (blockedStatuses.includes(user.status)) {
            return res.status(403).json({ success: false, message: `Account is ${user.status}. Contact support.` });
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastActivedAt: new Date(), isOnline: true } });

        const token = generateToken(user.id);

        const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: fullUserSelect });

        return res.json({
            success: true,
            message: 'Login successful',
            data: { token, user: fullUser },
        });
    } catch (error) {
        console.error('Mobile login error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Login failed' });
    }
};

// @desc    Register new user (rider)
// @route   POST /apimobile/user/auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const { name, email, phone, password, confirmPassword } = req.body;

        if (!name || !phone || !password) {
            return res.status(400).json({ success: false, message: 'Name, phone and password are required' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        const existing = await prisma.user.findFirst({
            where: { OR: [email ? { email: email.toLowerCase() } : {}, { contactNumber: phone }].filter(o => Object.keys(o).length > 0) },
        });

        if (existing) {
            return res.status(400).json({ success: false, message: 'User already exists with this phone or email' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Split name into first/last
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || nameParts[0];

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email: email ? email.toLowerCase() : null,
                contactNumber: phone,
                password: hashedPassword,
                userType: 'rider',
                status: 'active',
                avatar: null,
                referralCode: `USR${Date.now()}`,
            },
            select: fullUserSelect,
        });

        // Create wallet
        await prisma.wallet.create({ data: { userId: user.id, balance: 0 } });

        const token = generateToken(user.id);

        return res.status(201).json({
            success: true,
            message: 'Registration successful. OTP sent to your phone.',
            data: { token, user },
        });
    } catch (error) {
        console.error('Mobile register error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
    }
};

// @desc    Send OTP (fixed 123456 for now)
// @route   POST /apimobile/user/auth/send-otp
// @access  Private
export const sendOtp = async (req, res) => {
    try {
        const userId = req.user.id;
        const otp = '123456';
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({ where: { id: userId }, data: { otp, otpExpiresAt } });

        return res.json({
            success: true,
            message: 'OTP sent successfully',
            data: { otp }, // For dev only – remove in production
        });
    } catch (error) {
        console.error('Send OTP error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to send OTP' });
    }
};

// @desc    Verify OTP and activate account
// @route   POST /apimobile/user/auth/submit-otp
// @access  Private
export const submitOtp = async (req, res) => {
    try {
        const userId = req.user.id;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (user.otpExpiresAt && new Date() > user.otpExpiresAt) {
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { status: 'active', otp: null, otpExpiresAt: null, otpVerifyAt: new Date() },
            select: fullUserSelect,
        });

        const token = generateToken(userId);

        return res.json({
            success: true,
            message: 'OTP verified successfully. Account activated.',
            data: { token, user: updatedUser },
        });
    } catch (error) {
        console.error('Submit OTP error:', error);
        return res.status(500).json({ success: false, message: error.message || 'OTP verification failed' });
    }
};

// @desc    Get current user location
// @route   GET /apimobile/user/auth/current-location
// @access  Private
export const currentUserLocation = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, latitude: true, longitude: true, lastLocationUpdateAt: true },
        });

        return res.json({
            success: true,
            message: 'Location retrieved',
            data: {
                user_id: user.id,
                latitude: user.latitude,
                longitude: user.longitude,
                lastUpdatedAt: user.lastLocationUpdateAt,
            },
        });
    } catch (error) {
        console.error('Get location error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get location' });
    }
};
