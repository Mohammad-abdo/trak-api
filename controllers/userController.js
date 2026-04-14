import prisma from "../utils/prisma.js";
import { getDashboardPermissionPayload } from "../utils/staffPermissions.js";
import bcrypt from "bcryptjs";
import { generateExcel, generatePDF, generateCSV, formatDate } from "../utils/exportUtils.js";
import { saveAdminNotification } from "../utils/notificationService.js";
import { fullImageUrl } from "../utils/imageUrl.js";

// @desc    Get user list with advanced filtering
// @route   GET /api/users/user-list
// @access  Private (admin or sub_admin with users.view / drivers.view / riders.view)
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
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { email: { contains: search } },
                { contactNumber: { contains: search } },
            ];
        }

        if (contactNumber) {
            where.contactNumber = { contains: contactNumber };
        }

        if (email) {
            where.email = { contains: email };
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
                    avatar: true,
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

        const usersWithAvatar = users.map(u => ({
            ...u,
            avatar: fullImageUrl(req, u.avatar) || null,
        }));

        res.json({
            success: true,
            data: usersWithAvatar,
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
// @route   GET /api/users/user-detail
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

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const rbac = await getDashboardPermissionPayload(req.user.id, user.userType);

        res.json({
            success: true,
            data: {
                ...user,
                permissionNames: rbac.permissionNames,
                isDashboardAdmin: rbac.isDashboardAdmin,
            },
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
                latitude: true,
                longitude: true,
                isOnline: true,
                isAvailable: true,
            },
        });

        if (latitude !== undefined && longitude !== undefined && req.user.userType === "driver") {
            try {
                const { emitDriverLocationUpdate } = await import("../utils/socketService.js");
                const io = req.app.get("io") || global.io;
                if (io) {
                    emitDriverLocationUpdate(io, req.user.id, {
                        ...user,
                        latitude: user.latitude ?? latitude,
                        longitude: user.longitude ?? longitude,
                    });
                }
            } catch (e) {
                console.warn("Socket emit driver location:", e.message);
            }
        }

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
        const rows = await prisma.setting.findMany();
        const map = {};
        rows.forEach((r) => (map[r.key] = r.value));

        res.json({
            success: true,
            data: {
                appName: map.appName || "Tovo",
                version: "1.0.0",
                currency: map.currency || "USD",
                currencySymbol: map.currencySymbol || "$",
                distanceUnit: map.distanceUnit || "km",
                system_commission_percentage: map.system_commission_percentage || "15",
                ride_negotiation_enabled: map.ride_negotiation_enabled || "false",
                ride_negotiation_max_percent: map.ride_negotiation_max_percent || "20",
                ride_negotiation_max_rounds: map.ride_negotiation_max_rounds || "3",
                ride_negotiation_timeout_seconds: map.ride_negotiation_timeout_seconds || "90",
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

// @desc    Get single user full profile (admin)
// @route   GET /api/users/:id/profile
// @access  Private (Admin)
export const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                username: true,
                contactNumber: true,
                countryCode: true,
                gender: true,
                address: true,
                userType: true,
                status: true,
                isOnline: true,
                isAvailable: true,
                isVerifiedDriver: true,
                latitude: true,
                longitude: true,
                avatar: true,
                referralCode: true,
                serviceId: true,
                fleetId: true,
                lastActivedAt: true,
                appVersion: true,
                createdAt: true,
                updatedAt: true,
                service: { select: { id: true, name: true, nameAr: true } },
                fleet: { select: { id: true, firstName: true, lastName: true } },
                userDetail: true,
                bankAccount: true,
                wallet: { select: { id: true, balance: true, currency: true, updatedAt: true } },
                driverDocuments: {
                    include: { document: { select: { id: true, name: true, nameAr: true, type: true, isRequired: true, hasExpiryDate: true } } },
                    orderBy: { createdAt: "desc" },
                },
                driverServices: {
                    include: { service: { select: { id: true, name: true, nameAr: true } } },
                },
                driverRideRequests: {
                    select: { id: true, status: true, totalAmount: true },
                },
            },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const rideRequests = user.driverRideRequests || [];
        const stats = {
            totalRides: rideRequests.length,
            completedRides: rideRequests.filter((r) => r.status === "completed").length,
            cancelledRides: rideRequests.filter((r) => r.status === "cancelled").length,
            totalEarnings: rideRequests
                .filter((r) => r.status === "completed")
                .reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0),
        };

        const { driverRideRequests, ...userData } = user;
        res.json({ success: true, data: { ...userData, stats } });
    } catch (error) {
        console.error("Get user profile error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get paginated rides for a specific driver (admin)
// @route   GET /api/users/:id/rides
// @access  Private (Admin)
export const getDriverRides = async (req, res) => {
    try {
        const driverId = parseInt(req.params.id);
        const {
            status,
            page = 1,
            per_page = 15,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const where = { driverId };
        if (status && status !== "all") where.status = status;

        const skip = (parseInt(page) - 1) * parseInt(per_page);
        const orderBy = { [sortBy]: sortOrder === "asc" ? "asc" : "desc" };

        const [rides, total] = await Promise.all([
            prisma.rideRequest.findMany({
                where,
                include: {
                    rider: { select: { id: true, firstName: true, lastName: true, contactNumber: true, avatar: true } },
                    service: { select: { id: true, name: true, nameAr: true } },
                },
                skip,
                take: parseInt(per_page),
                orderBy,
            }),
            prisma.rideRequest.count({ where }),
        ]);

        res.json({
            success: true,
            data: rides,
            pagination: {
                total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                total_pages: Math.ceil(total / parseInt(per_page)),
            },
        });
    } catch (error) {
        console.error("Get driver rides error:", error);
        res.status(500).json({ success: false, message: error.message });
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

        const oldUser = await prisma.user.findUnique({ where: { id: parseInt(id) }, select: { status: true, userType: true } });

        const user = await prisma.user.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        if (oldUser?.status === 'pending' && oldUser?.userType === 'driver' && status && status !== 'pending') {
            const isApproved = status === 'active';
            saveAdminNotification(isApproved ? 'driver_approved' : 'new_complaint', {
                title: isApproved ? 'Driver Approved' : 'Driver Rejected',
                titleAr: isApproved ? 'تم قبول السائق' : 'تم رفض السائق',
                message: `${firstName} ${lastName || ''} has been ${isApproved ? 'approved' : 'rejected'}.`,
                messageAr: `${firstName} ${lastName || ''} تم ${isApproved ? 'قبوله' : 'رفضه'}.`,
                link: `/drivers/${id}`,
            }).catch(() => {});
        }

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
        const userId = parseInt(id);

        // Helper to safely delete (ignore errors if table/relation doesn't exist)
        const safeDelete = async (fn) => {
            try { await fn(); } catch (_) {}
        };

        // Delete related records first
        await safeDelete(() => prisma.walletHistory.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.wallet.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.driverDocument.deleteMany({ where: { driverId: userId } }));
        await safeDelete(() => prisma.userDetail.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.userBankAccount.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.rideRequestBid.deleteMany({ where: { driverId: userId } }));
        await safeDelete(() => prisma.adminNotificationRecipient.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.rideRequestRating.deleteMany({ where: { OR: [{ riderId: userId }, { driverId: userId }] } }));
        await safeDelete(() => prisma.rideRequest.deleteMany({ where: { OR: [{ riderId: userId }, { driverId: userId }] } }));
        await safeDelete(() => prisma.payment.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.notification.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.complaint.deleteMany({ where: { OR: [{ riderId: userId }, { driverId: userId }] } }));
        await safeDelete(() => prisma.driverService.deleteMany({ where: { driverId: userId } }));
        await safeDelete(() => prisma.withdrawRequest.deleteMany({ where: { userId } }));
        await safeDelete(() => prisma.user.delete({ where: { id: userId } }));

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

// @desc    Create driver with full data (admin)
// @route   POST /api/users/drivers
// @access  Private (Admin)
export const createDriver = async (req, res) => {
    try {
        const {
            firstName, lastName, email, password, contactNumber, countryCode,
            gender, address, status,
            carModel, carColor, carPlateNumber, carProductionYear,
            bankName, accountHolderName, accountNumber, bankIban, bankSwift,
            documentIds, documentExpireDates,
            serviceIds,
        } = req.body;

        if (!firstName || !contactNumber || !password) {
            return res.status(400).json({ success: false, message: "firstName, contactNumber and password are required" });
        }

        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    email ? { email: email.toLowerCase() } : undefined,
                    { contactNumber },
                ].filter(Boolean),
            },
        });
        if (existing) {
            return res.status(400).json({ success: false, message: "User with this email or phone already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const avatarPath = req.files?.avatar?.[0] ? `/uploads/drivers/${req.files.avatar[0].filename}` : null;
        const carImagePath = req.files?.carImage?.[0] ? `/uploads/drivers/${req.files.carImage[0].filename}` : null;

        const driver = await prisma.user.create({
            data: {
                firstName,
                lastName: lastName || firstName,
                email: email ? email.toLowerCase() : null,
                password: hashedPassword,
                contactNumber,
                countryCode: countryCode || null,
                gender: gender || null,
                address: address || null,
                userType: "driver",
                status: status || "active",
                avatar: avatarPath,
                displayName: `${firstName} ${lastName || ""}`.trim(),
                referralCode: `DRV${Date.now()}`,
                isVerified: true,
            },
        });

        if (carModel || carColor || carPlateNumber || carProductionYear || carImagePath) {
            await prisma.userDetail.create({
                data: {
                    userId: driver.id,
                    carModel: carModel || null,
                    carColor: carColor || null,
                    carPlateNumber: carPlateNumber || null,
                    carProductionYear: carProductionYear ? parseInt(carProductionYear) : null,
                    carImage: carImagePath,
                },
            });
        }

        if (bankName || accountNumber || bankIban) {
            await prisma.userBankAccount.create({
                data: {
                    userId: driver.id,
                    bankName: bankName || null,
                    accountHolderName: accountHolderName || null,
                    accountNumber: accountNumber || null,
                    bankIban: bankIban || null,
                    bankSwift: bankSwift || null,
                },
            });
        }

        const docFiles = req.files?.documents || [];
        const docIdArr = Array.isArray(documentIds) ? documentIds : documentIds ? [documentIds] : [];
        const docExpArr = Array.isArray(documentExpireDates) ? documentExpireDates : documentExpireDates ? [documentExpireDates] : [];

        for (let i = 0; i < docIdArr.length; i++) {
            const docId = parseInt(docIdArr[i]);
            if (isNaN(docId)) continue;
            const filePath = docFiles[i] ? `/uploads/driver-documents/${docFiles[i].filename}` : null;
            const expDate = docExpArr[i] ? new Date(docExpArr[i]) : null;
            await prisma.driverDocument.create({
                data: { 
                    driver: { connect: { id: driver.id } }, 
                    documentId: docId, 
                    isVerified: false, 
                    documentImage: filePath, 
                    expireDate: expDate 
                },
            });
        }

        const svcArr = Array.isArray(serviceIds) ? serviceIds : serviceIds ? [serviceIds] : [];
        for (const svcId of svcArr) {
            const id = parseInt(svcId);
            if (!isNaN(id)) {
                await prisma.driverService.create({ data: { driverId: driver.id, serviceId: id } });
            }
        }

        await prisma.wallet.create({ data: { userId: driver.id, balance: 0 } });

        const full = await prisma.user.findUnique({
            where: { id: driver.id },
            include: { userDetail: true, bankAccount: true, driverDocuments: { include: { document: true } }, driverServices: true, wallet: true },
        });

        res.status(201).json({ success: true, data: full, message: "Driver created successfully" });
    } catch (error) {
        console.error("Create driver error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update driver with full data (admin)
// @route   PUT /api/users/drivers/:id
// @access  Private (Admin)
export const updateDriver = async (req, res) => {
    try {
        const driverId = parseInt(req.params.id);
        const {
            firstName, lastName, email, password, contactNumber, countryCode,
            gender, address, status,
            carModel, carColor, carPlateNumber, carProductionYear,
            bankName, accountHolderName, accountNumber, bankIban, bankSwift,
            documentIds, documentExpireDates,
            serviceIds,
        } = req.body;

        const existing = await prisma.user.findUnique({ where: { id: driverId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Driver not found" });
        }

        const avatarPath = req.files?.avatar?.[0] ? `/uploads/drivers/${req.files.avatar[0].filename}` : undefined;
        const carImagePath = req.files?.carImage?.[0] ? `/uploads/drivers/${req.files.carImage[0].filename}` : undefined;

        const userData = {
            firstName: firstName || existing.firstName,
            lastName: lastName || existing.lastName,
            email: email ? email.toLowerCase() : existing.email,
            contactNumber: contactNumber || existing.contactNumber,
            countryCode: countryCode !== undefined ? countryCode : existing.countryCode,
            gender: gender !== undefined ? gender : existing.gender,
            address: address !== undefined ? address : existing.address,
            status: status || existing.status,
            displayName: `${firstName || existing.firstName} ${lastName || existing.lastName}`.trim(),
        };
        if (avatarPath) userData.avatar = avatarPath;
        if (password) userData.password = await bcrypt.hash(password, 10);

        await prisma.user.update({ where: { id: driverId }, data: userData });

        const carData = {};
        if (carModel !== undefined) carData.carModel = carModel;
        if (carColor !== undefined) carData.carColor = carColor;
        if (carPlateNumber !== undefined) carData.carPlateNumber = carPlateNumber;
        if (carProductionYear !== undefined) carData.carProductionYear = carProductionYear ? parseInt(carProductionYear) : null;
        if (carImagePath) carData.carImage = carImagePath;

        if (Object.keys(carData).length > 0) {
            await prisma.userDetail.upsert({
                where: { userId: driverId },
                create: { userId: driverId, ...carData },
                update: carData,
            });
        }

        const bankData = {};
        if (bankName !== undefined) bankData.bankName = bankName;
        if (accountHolderName !== undefined) bankData.accountHolderName = accountHolderName;
        if (accountNumber !== undefined) bankData.accountNumber = accountNumber;
        if (bankIban !== undefined) bankData.bankIban = bankIban;
        if (bankSwift !== undefined) bankData.bankSwift = bankSwift;

        if (Object.keys(bankData).length > 0) {
            const existingBank = await prisma.userBankAccount.findFirst({ where: { userId: driverId } });
            if (existingBank) {
                await prisma.userBankAccount.update({ where: { id: existingBank.id }, data: bankData });
            } else {
                await prisma.userBankAccount.create({ data: { userId: driverId, ...bankData } });
            }
        }

        const docFiles = req.files?.documents || [];
        const docIdArr = Array.isArray(documentIds) ? documentIds : documentIds ? [documentIds] : [];
        const docExpArr = Array.isArray(documentExpireDates) ? documentExpireDates : documentExpireDates ? [documentExpireDates] : [];

        for (let i = 0; i < docIdArr.length; i++) {
            const docId = parseInt(docIdArr[i]);
            if (isNaN(docId)) continue;
            const filePath = docFiles[i] ? `/uploads/driver-documents/${docFiles[i].filename}` : null;
            const expDate = docExpArr[i] ? new Date(docExpArr[i]) : null;

            const existingDoc = await prisma.driverDocument.findFirst({
                where: { driverId, documentId: docId },
            });
            if (existingDoc) {
                const updateData = {};
                if (filePath) updateData.documentImage = filePath;
                if (expDate) updateData.expireDate = expDate;
                if (Object.keys(updateData).length > 0) {
                    await prisma.driverDocument.update({ where: { id: existingDoc.id }, data: updateData });
                }
            } else {
                await prisma.driverDocument.create({
                    data: { 
                        driver: { connect: { id: driverId } }, 
                        documentId: docId, 
                        isVerified: false, 
                        documentImage: filePath, 
                        expireDate: expDate 
                    },
                });
            }
        }

        if (serviceIds !== undefined) {
            await prisma.driverService.deleteMany({ where: { driverId } });
            const svcArr = Array.isArray(serviceIds) ? serviceIds : serviceIds ? [serviceIds] : [];
            for (const svcId of svcArr) {
                const id = parseInt(svcId);
                if (!isNaN(id)) {
                    await prisma.driverService.create({ data: { driverId, serviceId: id } });
                }
            }
        }

        const full = await prisma.user.findUnique({
            where: { id: driverId },
            include: { userDetail: true, bankAccount: true, driverDocuments: { include: { document: true } }, driverServices: true, wallet: true },
        });

        res.json({ success: true, data: full, message: "Driver updated successfully" });
    } catch (error) {
        console.error("Update driver error:", error);
        res.status(500).json({ success: false, message: error.message });
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
