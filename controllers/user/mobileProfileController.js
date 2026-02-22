import prisma from '../../utils/prisma.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    referralCode: true,
    createdAt: true,
    userDetail: {
        select: {
            carModel: true,
            carColor: true,
            carPlateNumber: true,
            homeAddress: true,
            workAddress: true,
        },
    },
    wallet: { select: { balance: true, currency: true } },
};

// @desc    Get current user's full profile
// @route   GET /apimobile/user/profile
// @access  Private
export const myProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: fullUserSelect,
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({ success: true, message: 'Profile retrieved', data: user });
    } catch (error) {
        console.error('My profile error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get profile' });
    }
};

// @desc    Update user profile (name, avatar, etc.)
// @route   PUT /apimobile/user/profile/update
// @access  Private
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { firstName, lastName, email, gender, address } = req.body;

        const updateData = {};
        if (firstName !== undefined) updateData.firstName = firstName;
        if (lastName !== undefined) updateData.lastName = lastName;
        if (email !== undefined) updateData.email = email.toLowerCase();
        if (gender !== undefined) updateData.gender = gender;
        if (address !== undefined) updateData.address = address;

        // Handle avatar file upload
        if (req.file) {
            updateData.avatar = `/uploads/${req.file.filename}`;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: fullUserSelect,
        });

        return res.json({ success: true, message: 'Profile updated successfully', data: user });
    } catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to update profile' });
    }
};

// @desc    Delete user account
// @route   DELETE /apimobile/user/profile/delete
// @access  Private
export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        await prisma.user.update({
            where: { id: userId },
            data: { status: 'deleted', isOnline: false },
        });

        return res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to delete account' });
    }
};

// @desc    Get user saved addresses
// @route   GET /apimobile/user/addresses
// @access  Private
export const getUserAddresses = async (req, res) => {
    try {
        const userId = req.user.id;

        const addresses = await prisma.userAddress.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            select: { id: true, title: true, address: true, latitude: true, longitude: true, isDefault: true },
        });

        return res.json({ success: true, message: 'Addresses retrieved', data: addresses });
    } catch (error) {
        console.error('Get addresses error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get addresses' });
    }
};

// @desc    Add a new address
// @route   POST /apimobile/user/addresses
// @access  Private
export const addAddress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { title, address, latitude, longitude, isDefault = false } = req.body;

        if (!address) {
            return res.status(400).json({ success: false, message: 'Address is required' });
        }

        // If setting as default, unset others
        if (isDefault) {
            await prisma.userAddress.updateMany({ where: { userId }, data: { isDefault: false } });
        }

        const newAddress = await prisma.userAddress.create({
            data: { userId, title, address, latitude: String(latitude ?? ''), longitude: String(longitude ?? ''), isDefault },
            select: { id: true, title: true, address: true, latitude: true, longitude: true, isDefault: true },
        });

        return res.status(201).json({ success: true, message: 'Address added', data: newAddress });
    } catch (error) {
        console.error('Add address error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to add address' });
    }
};

// @desc    Delete an address
// @route   DELETE /apimobile/user/addresses/:id
// @access  Private
export const deleteAddress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const addr = await prisma.userAddress.findFirst({ where: { id: parseInt(id), userId } });

        if (!addr) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        await prisma.userAddress.delete({ where: { id: parseInt(id) } });

        return res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
        console.error('Delete address error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to delete address' });
    }
};
