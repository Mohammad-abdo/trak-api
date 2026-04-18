import bcrypt from 'bcryptjs';
import prisma from '../../utils/prisma.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { successResponse, errorResponse } from '../../utils/serverResponse.js';

// =============================================
// DEVICE / PUSH TOKEN
// =============================================

// @desc    Register / update the user's push-notification token (FCM + OneSignal)
// @route   POST /apimobile/user/device-token
// @access  Private
export const registerDeviceToken = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { fcmToken, playerId, appVersion, platform } = req.body || {};

    if (!fcmToken && !playerId) {
        return errorResponse(res, 'fcmToken or playerId is required', 400);
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(fcmToken !== undefined ? { fcmToken } : {}),
            ...(playerId !== undefined ? { playerId } : {}),
            ...(appVersion ? { appVersion } : {}),
        },
        select: { id: true, fcmToken: true, playerId: true, appVersion: true, updatedAt: true },
    });

    return successResponse(res, { ...updated, platform: platform ?? null }, 'Device token registered');
});

// =============================================
// CHANGE PASSWORD (logged in)
// =============================================

// @desc    Change password while logged in
// @route   POST /apimobile/user/auth/change-password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
        return errorResponse(res, 'currentPassword and newPassword are required', 400);
    }
    if (String(newPassword).length < 6) {
        return errorResponse(res, 'newPassword must be at least 6 characters', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, password: true } });
    if (!user) return errorResponse(res, 'User not found', 404);

    const ok = user.password ? await bcrypt.compare(currentPassword, user.password) : false;
    if (!ok) return errorResponse(res, 'Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

    return successResponse(res, { changed: true }, 'Password changed successfully');
});

// =============================================
// COMPLAINTS (user side)
// =============================================

// @desc    File a new complaint
// @route   POST /apimobile/user/complaints
// @access  Private
export const createComplaint = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { subject, description, rideRequestId, driverId } = req.body || {};

    if (!subject || !description) {
        return errorResponse(res, 'subject and description are required', 400);
    }

    // Validate the ride belongs to this rider when provided
    let resolvedRideRequestId = null;
    let resolvedDriverId = driverId ? parseInt(driverId, 10) : null;

    if (rideRequestId) {
        const rid = parseInt(rideRequestId, 10);
        const ride = await prisma.rideRequest.findFirst({
            where: { id: rid, riderId: userId },
            select: { id: true, driverId: true },
        });
        if (!ride) return errorResponse(res, 'Ride not found or not yours', 404);
        resolvedRideRequestId = ride.id;
        if (!resolvedDriverId) resolvedDriverId = ride.driverId || null;
    }

    const complaint = await prisma.complaint.create({
        data: {
            riderId: userId,
            driverId: resolvedDriverId,
            complaintBy: 'rider',
            subject: String(subject).slice(0, 250),
            description: String(description),
            rideRequestId: resolvedRideRequestId,
            status: 'pending',
        },
        select: {
            id: true, subject: true, description: true, status: true,
            rideRequestId: true, driverId: true, createdAt: true,
        },
    });

    return successResponse(res, complaint, 'Complaint submitted', 201);
});

// @desc    List my complaints
// @route   GET /apimobile/user/complaints
// @access  Private
export const listMyComplaints = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));

    const [items, total] = await Promise.all([
        prisma.complaint.findMany({
            where: { riderId: userId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, subject: true, description: true, status: true,
                rideRequestId: true, driverId: true, createdAt: true, updatedAt: true,
            },
        }),
        prisma.complaint.count({ where: { riderId: userId } }),
    ]);

    return successResponse(res, { total, page, limit, items }, 'Complaints retrieved');
});

// =============================================
// COUPONS
// =============================================

// @desc    Validate a coupon code
// @route   POST /apimobile/user/coupons/validate
// @access  Private
export const validateCoupon = asyncHandler(async (req, res) => {
    const { code, amount } = req.body || {};
    if (!code) return errorResponse(res, 'code is required', 400);

    const coupon = await prisma.coupon.findFirst({
        where: {
            code: String(code).trim(),
            status: 1,
            AND: [
                { OR: [{ startDate: null }, { startDate: { lte: new Date() } }] },
                { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
            ],
        },
    });

    if (!coupon) return errorResponse(res, 'Invalid or expired coupon', 404);

    const orderAmount = amount !== undefined ? parseFloat(amount) : null;
    if (orderAmount !== null && coupon.minimumAmount && orderAmount < coupon.minimumAmount) {
        return errorResponse(res, `Minimum order amount is ${coupon.minimumAmount}`, 400);
    }

    let discountValue = 0;
    if (orderAmount !== null) {
        if ((coupon.discountType || '').toLowerCase() === 'percentage') {
            discountValue = (orderAmount * (coupon.discount || 0)) / 100;
            if (coupon.maximumDiscount && discountValue > coupon.maximumDiscount) {
                discountValue = coupon.maximumDiscount;
            }
        } else {
            discountValue = coupon.discount || 0;
        }
        discountValue = Math.max(0, Math.round(discountValue * 100) / 100);
    }

    return successResponse(res, {
        coupon: {
            id: coupon.id,
            code: coupon.code,
            title: coupon.title,
            titleAr: coupon.titleAr,
            discountType: coupon.discountType,
            discount: coupon.discount,
            minimumAmount: coupon.minimumAmount,
            maximumDiscount: coupon.maximumDiscount,
            endDate: coupon.endDate,
        },
        orderAmount,
        discountValue,
        finalAmount: orderAmount !== null ? Math.max(0, orderAmount - discountValue) : null,
    }, 'Coupon valid');
});

// =============================================
// REFERRAL
// =============================================

// @desc    Get my referral info
// @route   GET /apimobile/user/referral
// @access  Private
export const getMyReferral = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    let user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, referralCode: true, partnerReferralCode: true, firstName: true },
    });

    if (!user) return errorResponse(res, 'User not found', 404);

    // Generate a referral code if missing
    if (!user.referralCode) {
        const code = `R${userId}${Date.now().toString(36).toUpperCase()}`.slice(0, 16);
        user = await prisma.user.update({
            where: { id: userId },
            data: { referralCode: code },
            select: { id: true, referralCode: true, partnerReferralCode: true, firstName: true },
        });
    }

    const invitedCount = await prisma.user.count({ where: { partnerReferralCode: user.referralCode } });

    return successResponse(res, {
        referralCode: user.referralCode,
        partnerReferralCode: user.partnerReferralCode,
        invitedCount,
        shareMessage: `Join me on OfferGo! Use my code ${user.referralCode} to sign up.`,
    }, 'Referral info retrieved');
});

// =============================================
// SOS CONTACTS (saved emergency contacts)
// =============================================

// @desc    List my SOS / emergency contacts
// @route   GET /apimobile/user/sos-contacts
// @access  Private
export const listSosContacts = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const contacts = await prisma.sos.findMany({
        where: { userId, status: 1 },
        orderBy: { id: 'asc' },
        select: { id: true, name: true, nameAr: true, contactNumber: true, createdAt: true },
    });
    return successResponse(res, contacts, 'SOS contacts retrieved');
});

// @desc    Add an SOS / emergency contact
// @route   POST /apimobile/user/sos-contacts
// @access  Private
export const addSosContact = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, nameAr, contactNumber } = req.body || {};
    if (!name || !contactNumber) {
        return errorResponse(res, 'name and contactNumber are required', 400);
    }
    const created = await prisma.sos.create({
        data: {
            userId,
            name: String(name).slice(0, 100),
            nameAr: nameAr ? String(nameAr).slice(0, 100) : null,
            contactNumber: String(contactNumber).slice(0, 30),
            status: 1,
        },
        select: { id: true, name: true, nameAr: true, contactNumber: true, createdAt: true },
    });
    return successResponse(res, created, 'SOS contact added', 201);
});

// @desc    Delete an SOS / emergency contact
// @route   DELETE /apimobile/user/sos-contacts/:id
// @access  Private
export const deleteSosContact = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (!id) return errorResponse(res, 'Invalid id', 400);

    const existing = await prisma.sos.findFirst({ where: { id, userId } });
    if (!existing) return errorResponse(res, 'SOS contact not found', 404);

    await prisma.sos.delete({ where: { id } });
    return successResponse(res, { deleted: true, id }, 'SOS contact deleted');
});
