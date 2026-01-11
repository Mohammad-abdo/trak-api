import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";
import { generateExcel, generatePDF, generateCSV, formatDate } from "../utils/exportUtils.js";

// @desc    Get user list with advanced filtering
// @route   GET /api/users/list
// @access  Public
export const getUserList = async (req, res) => {
    try {
        const {
            userType,
            status,
            fleetId,
            serviceId,
            isOnline,
            isAvailable,
            search,
            contactNumber,
            email,
            lastActiveFilter, // 'active_user', 'engaged_user', 'inactive_user'
            per_page = 10,
            page = 1,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const where = {};

        // Basic filters
        if (userType) where.userType = userType;
        if (status) where.status = status;
        if (fleetId) where.fleetId = parseInt(fleetId);
        if (serviceId) where.serviceId = parseInt(serviceId);
        if (isOnline !== undefined) where.isOnline = isOnline === "true" || isOnline === true;
        if (isAvailable !== undefined) where.isAvailable = isAvailable === "true" || isAvailable === true;

        // Search filters
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { contactNumber: { contains: search, mode: "insensitive" } },
            ];
        }

        if (contactNumber) {
            where.contactNumber = { contains: contactNumber, mode: "insensitive" };
        }

        if (email) {
            where.email = { contains: email, mode: "insensitive" };
        }

        // Last active filter
        if (lastActiveFilter) {
            const now = new Date();
            if (lastActiveFilter === "active_user") {
                where.lastActivedAt = {
                    gte: new Date(now.setHours(0, 0, 0, 0)),
                };
            } else if (lastActiveFilter === "engaged_user") {
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                const fifteenDaysAgo = new Date(now);
                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                where.lastActivedAt = {
                    gte: fifteenDaysAgo,
                    lt: yesterday,
                };
            } else if (lastActiveFilter === "inactive_user") {
                const fifteenDaysAgo = new Date(now);
                fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
                where.OR = [
                    { lastActivedAt: { lte: fifteenDaysAgo } },
                    { lastActivedAt: null },
                ];
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        // Build orderBy
        const orderBy = {};
        orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    contactNumber: true,
                    userType: true,
                    status: true,
                    isOnline: true,
                    isAvailable: true,
                    fleetId: true,
                    serviceId: true,
                    lastActivedAt: true,
                    createdAt: true,
                    updatedAt: true,
                },
                skip,
                take: parseInt(per_page),
                orderBy,
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            data: users,
            pagination: {
                total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                total_pages: Math.ceil(total / parseInt(per_page)),
            },
        });
    } catch (error) {
        console.error("Get user list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get user detail
// @route   GET /api/users/detail
// @access  Private
export const getUserDetail = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
                countryCode: true,
                gender: true,
                address: true,
                userType: true,
                status: true,
                isOnline: true,
                isAvailable: true,
                latitude: true,
                longitude: true,
                serviceId: true,
                fleetId: true,
                referralCode: true,
                service: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                fleet: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error("Get user detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update profile
// @route   POST /api/users/update-profile
// @access  Private
export const updateProfile = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            contactNumber,
            gender,
            address,
            latitude,
            longitude,
            fcmToken,
            playerId,
        } = req.body;

        const updateData = {};

        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (email) updateData.email = email.toLowerCase();
        if (contactNumber) updateData.contactNumber = contactNumber;
        if (gender) updateData.gender = gender;
        if (address) updateData.address = address;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (fcmToken) updateData.fcmToken = fcmToken;
        if (playerId) updateData.playerId = playerId;

        if (latitude !== undefined && longitude !== undefined) {
            updateData.lastLocationUpdateAt = new Date();
        }

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
            },
        });

        res.json({
            success: true,
            message: "Profile updated successfully",
            data: user,
        });
    } catch (error) {
        console.error("Update profile error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Change password
// @route   POST /api/users/change-password
// @access  Private
export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Old password and new password are required",
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { password: true },
        });

        if (!user.password) {
            return res.status(400).json({
                success: false,
                message: "Password not set for this account",
            });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Old password is incorrect",
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: req.user.id },
            data: { password: hashedPassword },
        });

        res.json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (error) {
        console.error("Change password error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update user status
// @route   POST /api/users/update-user-status
// @access  Private
export const updateUserStatus = async (req, res) => {
    try {
        const { isOnline, isAvailable } = req.body;

        const updateData = {};

        if (isOnline !== undefined) updateData.isOnline = isOnline;
        if (isAvailable !== undefined) updateData.isAvailable = isAvailable;

        if (isOnline) {
            updateData.lastActivedAt = new Date();
        }

        const user = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
            select: {
                isOnline: true,
                isAvailable: true,
            },
        });

        res.json({
            success: true,
            message: "Status updated successfully",
            data: user,
        });
    } catch (error) {
        console.error("Update user status error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete user account
// @route   POST /api/users/delete-user-account
// @access  Private
export const deleteUserAccount = async (req, res) => {
    try {
        await prisma.user.delete({
            where: { id: req.user.id },
        });

        res.json({
            success: true,
            message: "Account deleted successfully",
        });
    } catch (error) {
        console.error("Delete user account error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get app settings
// @route   GET /api/users/get-appsetting
// @access  Public
export const getAppSetting = async (req, res) => {
    try {
        // TODO: Implement app settings from database
        res.json({
            success: true,
            data: {
                appName: "Tovo",
                version: "1.0.0",
                currency: "USD",
                currencySymbol: "$",
                distanceUnit: "km",
            },
        });
    } catch (error) {
        console.error("Get app setting error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create user (admin)
// @route   POST /api/users
// @access  Private (Admin)
export const createUser = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            userType,
            address,
        } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { contactNumber }],
            },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User with this email or contact number already exists",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate username
        const username = email.split("@")[0] + Math.floor(Math.random() * 1000);

        const user = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                username,
                password: hashedPassword,
                contactNumber,
                userType: userType || "rider",
                address,
                displayName: `${firstName} ${lastName}`,
                status: "active",
            },
        });

        res.status(201).json({
            success: true,
            data: user,
            message: "User created successfully",
        });
    } catch (error) {
        console.error("Create user error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update user (admin)
// @route   PUT /api/users/:id
// @access  Private (Admin)
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, contactNumber, address, status, password } =
            req.body;

        const updateData = {
            firstName,
            lastName,
            email,
            contactNumber,
            address,
            status,
            displayName: `${firstName} ${lastName}`,
        };

        // Update password if provided
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: user,
            message: "User updated successfully",
        });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete user (admin)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.user.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Export users (riders/drivers)
// @route   GET /api/users/export
// @access  Private (Admin)
export const exportUsers = async (req, res) => {
    try {
        const { userType, status, format = 'excel' } = req.query;

        const where = {};
        if (userType) where.userType = userType;
        if (status) where.status = status;

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
                userType: true,
                status: true,
                isOnline: true,
                isAvailable: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Prepare data for export
        const exportData = users.map((user) => ({
            'ID': user.id,
            'First Name': user.firstName || '',
            'Last Name': user.lastName || '',
            'Email': user.email || '',
            'Contact Number': user.contactNumber || '',
            'User Type': user.userType || '',
            'Status': user.status || '',
            'Online': user.isOnline ? 'Yes' : 'No',
            'Available': user.isAvailable ? 'Yes' : 'No',
            'Created At': formatDate(user.createdAt),
        }));

        const headers = [
            { key: 'ID', label: 'ID' },
            { key: 'First Name', label: 'First Name' },
            { key: 'Last Name', label: 'Last Name' },
            { key: 'Email', label: 'Email' },
            { key: 'Contact Number', label: 'Contact Number' },
            { key: 'User Type', label: 'User Type' },
            { key: 'Status', label: 'Status' },
            { key: 'Online', label: 'Online' },
            { key: 'Available', label: 'Available' },
            { key: 'Created At', label: 'Created At' },
        ];

        const title = userType === 'rider' ? 'Riders Report' : userType === 'driver' ? 'Drivers Report' : 'Users Report';

        if (format === 'pdf') {
            const pdfBuffer = await generatePDF(exportData, headers, title);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
            res.send(pdfBuffer);
        } else if (format === 'csv') {
            const csv = generateCSV(exportData, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.csv`);
            res.send(csv);
        } else {
            // Excel (default)
            const excelBuffer = await generateExcel(exportData, headers, `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.xlsx`, {
                title,
                sheetName: userType === 'rider' ? 'Riders' : userType === 'driver' ? 'Drivers' : 'Users',
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.xlsx`);
            res.send(excelBuffer);
        }
    } catch (error) {
        console.error("Export users error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
