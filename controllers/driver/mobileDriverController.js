import prisma from "../../utils/prisma.js";
import bcrypt from "bcryptjs";
import { generateOtp, getOtpExpiresAt } from "../../utils/otpHelper.js";
import { sendOtpSms } from "../../utils/smsService.js";
import { generateToken } from "../../utils/jwtHelper.js";
import { generateUniqueReferralCode } from "../auth/register.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/serverResponse.js";
import { fullImageUrl } from "../../utils/imageUrl.js";
import { saveAdminNotification } from "../../utils/notificationService.js";
import { replayPendingRidesForDriver } from "../../utils/replayPendingRidesForDriver.js";

const driverProfileSelect = {
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
    avatar: true,
    isOnline: true,
    isAvailable: true,
    isVerifiedDriver: true,
    isVerified: true,
    referralCode: true,
    serviceId: true,
    latitude: true,
    longitude: true,
    appVersion: true,
    lastActivedAt: true,
    createdAt: true,
    service: { select: { id: true, name: true, nameAr: true } },
    userDetail: true,
    bankAccount: true,
    wallet: { select: { id: true, balance: true, currency: true } },
    driverDocuments: {
        include: {
            document: { select: { id: true, name: true, nameAr: true, type: true, isRequired: true, hasExpiryDate: true } },
        },
        orderBy: { createdAt: "desc" },
    },
    driverServices: {
        include: { service: { select: { id: true, name: true, nameAr: true } } },
    },
};

const bankCardSelect = {
    id: true,
    cardHolderName: true,
    lastFourDigits: true,
    brand: true,
    expiryMonth: true,
    expiryYear: true,
    isDefault: true,
    createdAt: true,
};

function formatDriverResponse(driver, req) {
    if (!driver) return null;
    return {
        ...driver,
        avatar: driver.avatar ? fullImageUrl(req, driver.avatar) : null,
        userDetail: driver.userDetail
            ? {
                  ...driver.userDetail,
                  carImage: driver.userDetail.carImage ? fullImageUrl(req, driver.userDetail.carImage) : null,
              }
            : null,
        driverDocuments: dedupeDriverDocumentsByType(driver.driverDocuments || []).map((dd) => ({
            ...dd,
            documentImage: dd.documentImage ? fullImageUrl(req, dd.documentImage) : null,
        })),
    };
}

// ─── Register Driver (full details) ──────────────────────────────────────────
export const registerDriver = asyncHandler(async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        contactNumber,
        countryCode,
        gender,
        address,
        serviceId,
        // Vehicle
        carModel,
        carColor,
        carPlateNumber,
        carProductionYear,
        // Bank (optional)
        bankName,
        accountHolderName,
        accountNumber,
        bankIban,
        bankSwift,
    } = req.body;

    if (!firstName || !contactNumber || !password) {
        return errorResponse(res, "firstName, contactNumber and password are required", 400);
    }
    if (confirmPassword && password !== confirmPassword) {
        return errorResponse(res, "Passwords do not match", 400);
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
        return errorResponse(res, "Driver already exists with this email or phone number", 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const referralCode = await generateUniqueReferralCode();
    const otp = generateOtp();
    const otpExpiresAt = getOtpExpiresAt();

    const avatarPath = req.files?.avatar?.[0]
        ? `/uploads/drivers/${req.files.avatar[0].filename}`
        : null;
    const carImagePath = req.files?.carImage?.[0]
        ? `/uploads/drivers/${req.files.carImage[0].filename}`
        : null;

    const driver = await prisma.user.create({
        data: {
            firstName,
            lastName,
            email: email?.toLowerCase(),
            password: hashedPassword,
            contactNumber,
            countryCode: countryCode || "+966",
            gender,
            address,
            userType: "driver",
            serviceId: serviceId ? parseInt(serviceId) : undefined,
            status: "pending",
            referralCode,
            otp,
            otpExpiresAt,
            isVerified: false,
            avatar: avatarPath,
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

    // Upload documents (any kind of files without documentIds)
    const docFiles = req.files?.documents || [];
    const fileList = Array.isArray(docFiles) ? docFiles : [docFiles];

    // Get or create a default "General" document type (schema: Document uses status, not isActive)
    let generalDoc = await prisma.document.findFirst({ where: { status: 1 } });
    if (!generalDoc) {
        generalDoc = await prisma.document.create({
            data: { name: "General", nameAr: "عام", status: 1 },
        });
    }

    for (const file of fileList) {
        const filePath = `/uploads/driver-documents/${file.filename}`;

        await prisma.driverDocument.create({
            data: {
                driver: { connect: { id: driver.id } },
                document: { connect: { id: generalDoc.id } },
                documentImage: filePath,
                isVerified: false,
            },
        });
    }

    await prisma.wallet.create({
        data: { userId: driver.id, balance: 0 },
    });

    if (contactNumber) {
        await sendOtpSms(contactNumber, otp);
    }

    const token = generateToken(driver.id);

    saveAdminNotification("new_driver", {
        title: "New Driver Registration",
        titleAr: "تسجيل سائق جديد",
        message: `${driver.firstName} ${driver.lastName || ''} registered via mobile and is pending approval.`,
        messageAr: `${driver.firstName} ${driver.lastName || ''} سجّل عبر التطبيق وينتظر الموافقة.`,
        link: `/drivers/${driver.id}`,
    }).catch(() => {});

    return successResponse(
        res,
        {
            token,
            user: {
                id: driver.id,
                firstName: driver.firstName,
                lastName: driver.lastName,
                email: driver.email,
                contactNumber: driver.contactNumber,
                userType: "driver",
                status: "pending",
                isVerified: false,
            },
        },
        "Driver registration successful. Waiting for admin approval.",
        201
    );
});

// ─── Get My Profile ──────────────────────────────────────────────────────────
export const getMyProfile = asyncHandler(async (req, res) => {
    const driver = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: driverProfileSelect,
    });
    if (!driver) return errorResponse(res, "Driver not found", 404);

    const rideRequests = await prisma.rideRequest.findMany({
        where: { driverId: req.user.id },
        select: { id: true, status: true, totalAmount: true },
    });

    const stats = {
        totalRides: rideRequests.length,
        completedRides: rideRequests.filter((r) => r.status === "completed").length,
        cancelledRides: rideRequests.filter((r) => r.status === "cancelled").length,
        totalEarnings: rideRequests
            .filter((r) => r.status === "completed")
            .reduce((s, r) => s + (parseFloat(r.totalAmount) || 0), 0),
    };

    return successResponse(res, { ...formatDriverResponse(driver, req), stats });
});

// ─── Update Profile ──────────────────────────────────────────────────────────
export const updateMyProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, gender, address, countryCode } = req.body;

    const updateData = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (gender !== undefined) updateData.gender = gender;
    if (address !== undefined) updateData.address = address;
    if (countryCode !== undefined) updateData.countryCode = countryCode;

    if (req.files?.avatar?.[0]) {
        updateData.avatar = `/uploads/drivers/${req.files.avatar[0].filename}`;
    }

    const driver = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: driverProfileSelect,
    });

    return successResponse(res, formatDriverResponse(driver, req), "Profile updated");
});

// ─── Delete Driver Account (soft delete) ─────────────────────────────────────
export const deleteMyAccount = asyncHandler(async (req, res) => {
    await prisma.user.update({
        where: { id: req.user.id },
        data: {
            status: "deleted",
            isOnline: false,
            isAvailable: false,
            pushNotificationsEnabled: false,
            fcmToken: null,
            playerId: null,
        },
    });

    return successResponse(res, { deleted: true }, "Driver account deleted successfully");
});

// ─── Update Vehicle ──────────────────────────────────────────────────────────
export const updateVehicle = asyncHandler(async (req, res) => {
    const { carModel, carColor, carPlateNumber, carProductionYear } = req.body;
    const carImagePath = req.files?.carImage?.[0]
        ? `/uploads/drivers/${req.files.carImage[0].filename}`
        : undefined;

    const data = {};
    if (carModel !== undefined) data.carModel = carModel;
    if (carColor !== undefined) data.carColor = carColor;
    if (carPlateNumber !== undefined) data.carPlateNumber = carPlateNumber;
    if (carProductionYear !== undefined) data.carProductionYear = parseInt(carProductionYear);
    if (carImagePath) data.carImage = carImagePath;

    const detail = await prisma.userDetail.upsert({
        where: { userId: req.user.id },
        update: data,
        create: { userId: req.user.id, ...data },
    });

    return successResponse(res, {
        ...detail,
        carImage: detail.carImage ? fullImageUrl(req, detail.carImage) : null,
    }, "Vehicle updated");
});

function collectDriverUploadFiles(req) {
    const f = req.files;
    if (!f) return [];
    const chunks = [];
    for (const key of ["files", "documents", "document"]) {
        const raw = f[key];
        if (!raw) continue;
        if (Array.isArray(raw)) chunks.push(...raw);
        else chunks.push(raw);
    }
    const seen = new Set();
    const out = [];
    for (const file of chunks) {
        if (file?.filename && !seen.has(file.filename)) {
            seen.add(file.filename);
            out.push(file);
        }
    }
    return out;
}

/** Parse document type IDs from multipart body (JSON string or comma-separated). */
function parseDocumentIdList(body) {
    if (!body || typeof body !== "object") return [];
    const rawIds =
        body.documentIds ??
        body.document_ids ??
        body["documentIds[]"] ??
        body["document_ids[]"];
    const documentId = body.documentId ?? body.document_id;
    if (rawIds != null) {
        if (Array.isArray(rawIds)) {
            return rawIds.map((x) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n));
        }
        if (typeof rawIds === "string") {
            const s = rawIds.trim();
            if (!s) {
                /* fall through to single documentId */
            } else if (s.startsWith("[")) {
                try {
                    const arr = JSON.parse(s);
                    if (Array.isArray(arr)) {
                        return arr.map((x) => parseInt(String(x), 10)).filter((n) => !Number.isNaN(n));
                    }
                } catch {
                    /* fall through */
                }
            } else {
                return s.split(/[,;]/).map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
            }
        }
    }
    const one = parseInt(String(documentId ?? ""), 10);
    return Number.isNaN(one) ? [] : [one];
}

function parseExpireDateList(body, len) {
    const out = new Array(len).fill(null);
    const { expireDates, expireDate } = body;
    if (Array.isArray(expireDates)) {
        for (let i = 0; i < len && i < expireDates.length; i++) {
            if (expireDates[i]) out[i] = new Date(expireDates[i]);
        }
        return out;
    }
    if (typeof expireDates === "string" && expireDates.trim()) {
        try {
            const arr = JSON.parse(expireDates);
            if (Array.isArray(arr)) {
                for (let i = 0; i < len && i < arr.length; i++) {
                    if (arr[i]) out[i] = new Date(arr[i]);
                }
                return out;
            }
        } catch {
            /* ignore */
        }
    }
    if (expireDate && len > 0) out[0] = new Date(expireDate);
    return out;
}

const driverDocInclude = {
    document: { select: { id: true, name: true, nameAr: true, type: true, isRequired: true, hasExpiryDate: true } },
};

/** Keeps one row per document type (newest wins); removes legacy duplicates from races / old clients. */
async function mergeDuplicateDriverDocuments(driverId) {
    const rows = await prisma.driverDocument.findMany({
        where: { driverId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    const seenDocType = new Set();
    const deleteIds = [];
    for (const row of rows) {
        if (!seenDocType.has(row.documentId)) seenDocType.add(row.documentId);
        else deleteIds.push(row.id);
    }
    if (deleteIds.length) {
        await prisma.driverDocument.deleteMany({ where: { id: { in: deleteIds } } });
    }
}

/** For API lists: one entry per document type (newest row). */
function dedupeDriverDocumentsByType(documents) {
    const byType = new Map();
    for (const d of documents) {
        const prev = byType.get(d.documentId);
        if (!prev) {
            byType.set(d.documentId, d);
            continue;
        }
        const prevT = new Date(prev.updatedAt).getTime();
        const curT = new Date(d.updatedAt).getTime();
        if (curT > prevT || (curT === prevT && d.id > prev.id)) byType.set(d.documentId, d);
    }
    return Array.from(byType.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ─── Upload Multiple Documents ───────────────────────────────────────────────
export const uploadDocuments = asyncHandler(async (req, res) => {
    const fileList = collectDriverUploadFiles(req);
    if (fileList.length === 0) {
        return errorResponse(
            res,
            "No files provided. Use multipart field name: files, documents, or document",
            400
        );
    }

    let idList = parseDocumentIdList(req.body);
    if (idList.length === 0 && fileList.length === 1) {
        const fb = await prisma.document.findFirst({ where: { status: 1 }, orderBy: { id: "asc" } });
        if (fb) idList = [fb.id];
    }
    if (idList.length === 0) {
        return errorResponse(
            res,
            "documentId or documentIds is required (IDs from GET /apimobile/driver/documents/required). Send documentId (one file) or documentIds as JSON e.g. [1,2] matching file order. Required when uploading more than one file.",
            400
        );
    }

    const expireList = parseExpireDateList(req.body, fileList.length);
    const driverId = req.user.id;
    const uploadedByDocType = new Map();

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const docTypeId = idList[i] ?? idList[idList.length - 1] ?? idList[0];
        if (!docTypeId || Number.isNaN(docTypeId)) {
            return errorResponse(res, `Invalid documentId for file at index ${i}`, 400);
        }

        const docType = await prisma.document.findFirst({
            where: { id: docTypeId, status: 1 },
        });
        if (!docType) {
            return errorResponse(res, `Unknown or inactive document type id: ${docTypeId}`, 400);
        }

        const filePath = `/uploads/driver-documents/${file.filename}`;
        const exp = expireList[i] ?? null;

        const existing = await prisma.driverDocument.findFirst({
            where: { driverId, documentId: docTypeId },
            orderBy: { id: "asc" },
        });

        if (existing) {
            await prisma.driverDocument.deleteMany({
                where: { driverId, documentId: docTypeId, id: { not: existing.id } },
            });
        }

        const updatePayload = {
            documentImage: filePath,
            isVerified: false,
        };
        if (exp) updatePayload.expireDate = exp;

        let driverDoc;
        if (existing) {
            driverDoc = await prisma.driverDocument.update({
                where: { id: existing.id },
                data: updatePayload,
                include: driverDocInclude,
            });
        } else {
            driverDoc = await prisma.driverDocument.create({
                data: {
                    driver: { connect: { id: driverId } },
                    document: { connect: { id: docTypeId } },
                    documentImage: filePath,
                    isVerified: false,
                    expireDate: exp,
                },
                include: driverDocInclude,
            });
        }

        uploadedByDocType.set(docTypeId, {
            ...driverDoc,
            documentImage: driverDoc.documentImage ? fullImageUrl(req, driverDoc.documentImage) : null,
        });
    }

    await mergeDuplicateDriverDocuments(driverId);

    return successResponse(
        res,
        Array.from(uploadedByDocType.values()),
        "Documents uploaded successfully"
    );
});

// ─── Get My Documents ──────────────────────────────────────────────────────────
export const getMyDocuments = asyncHandler(async (req, res) => {
    const documents = await prisma.driverDocument.findMany({
        where: { driverId: req.user.id },
        include: {
            document: { select: { id: true, name: true, nameAr: true, type: true, isRequired: true, hasExpiryDate: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    const uniqueByType = dedupeDriverDocumentsByType(documents);
    const formatted = uniqueByType.map((dd) => ({
        ...dd,
        documentImage: dd.documentImage ? fullImageUrl(req, dd.documentImage) : null,
    }));

    return successResponse(res, formatted);
});

export const getRequiredDocuments = asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
        where: { status: 1 },
        orderBy: [{ isRequired: "desc" }, { name: "asc" }],
    });
    return successResponse(res, documents);
});

// Public list of services for driver registration screens
export const getRegistrationServices = asyncHandler(async (req, res) => {
    const services = await prisma.service.findMany({
        where: { status: 1 },
        select: {
            id: true,
            name: true,
            nameAr: true,
            description: true,
            descriptionAr: true,
            baseFare: true,
            perDistance: true,
            capacity: true,
            status: true,
        },
        orderBy: [{ id: "asc" }],
    });

    return successResponse(res, services, "Services retrieved");
});

// ─── Update Bank Account ─────────────────────────────────────────────────────
export const updateBankAccount = asyncHandler(async (req, res) => {
    const { bankName, accountHolderName, accountNumber, bankIban, bankSwift, bankCode, bankAddress, routingNumber } = req.body;

    const data = {};
    if (bankName !== undefined) data.bankName = bankName;
    if (accountHolderName !== undefined) data.accountHolderName = accountHolderName;
    if (accountNumber !== undefined) data.accountNumber = accountNumber;
    if (bankIban !== undefined) data.bankIban = bankIban;
    if (bankSwift !== undefined) data.bankSwift = bankSwift;
    if (bankCode !== undefined) data.bankCode = bankCode;
    if (bankAddress !== undefined) data.bankAddress = bankAddress;
    if (routingNumber !== undefined) data.routingNumber = routingNumber;

    const bank = await prisma.userBankAccount.upsert({
        where: { userId: req.user.id },
        update: data,
        create: { userId: req.user.id, ...data },
    });

    return successResponse(res, bank, "Bank account updated");
});

// ─── Driver Bank Cards (tokenized/meta only) ─────────────────────────────────
export const addBankCard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { cardHolderName, lastFourDigits, brand, expiryMonth, expiryYear, isDefault = false } = req.body;

    const digits = String(lastFourDigits ?? "").replace(/\D/g, "").slice(-4);
    if (digits.length !== 4) {
        return errorResponse(res, "Valid last 4 digits of card are required", 400);
    }

    if (isDefault) {
        await prisma.userBankCard.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    const card = await prisma.userBankCard.create({
        data: {
            userId,
            cardHolderName: cardHolderName?.trim() || null,
            lastFourDigits: digits,
            brand: brand?.trim() || null,
            expiryMonth: expiryMonth != null ? parseInt(expiryMonth, 10) : null,
            expiryYear: expiryYear != null ? parseInt(expiryYear, 10) : null,
            isDefault: !!isDefault,
        },
        select: bankCardSelect,
    });

    return successResponse(res, card, "Card added", 201);
});

export const getBankCards = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const cards = await prisma.userBankCard.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: bankCardSelect,
    });

    return successResponse(res, cards, "Cards retrieved");
});

export const deleteBankCard = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return errorResponse(res, "Invalid card id", 400);
    }

    const card = await prisma.userBankCard.findFirst({ where: { id, userId } });
    if (!card) {
        return errorResponse(res, "Card not found", 404);
    }

    await prisma.userBankCard.delete({ where: { id } });
    return successResponse(res, null, "Card deleted");
});

// ─── Update Status (online / available) ──────────────────────────────────────
export const updateDriverStatus = asyncHandler(async (req, res) => {
    const { isOnline, isAvailable, latitude, longitude, currentHeading, fcmToken } = req.body;

    const updateData = {};
    if (isOnline !== undefined) updateData.isOnline = isOnline;
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    if (latitude !== undefined) updateData.latitude = String(latitude);
    if (longitude !== undefined) updateData.longitude = String(longitude);
    if (currentHeading !== undefined) updateData.currentHeading = currentHeading;
    if (fcmToken !== undefined) updateData.fcmToken = fcmToken;
    if (latitude !== undefined || longitude !== undefined) updateData.lastLocationUpdateAt = new Date();
    if (isOnline) updateData.lastActivedAt = new Date();

    const driver = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
            id: true,
            isOnline: true,
            isAvailable: true,
            latitude: true,
            longitude: true,
            currentHeading: true,
        },
    });

    if (latitude !== undefined && longitude !== undefined) {
        try {
            const { emitDriverLocationUpdate } = await import("../../utils/socketService.js");
            const io = req.app.get("io") || global.io;
            if (io) emitDriverLocationUpdate(io, req.user.id, driver);
        } catch (_) {}
    }

    return successResponse(res, driver, "Status updated");
});

// Update current driver location (usually called right after register/login)
export const currentDriverLocation = asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
        return errorResponse(res, "latitude and longitude are required", 400);
    }

    const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
            latitude: String(latitude),
            longitude: String(longitude),
            lastLocationUpdateAt: new Date(),
        },
        select: { id: true, latitude: true, longitude: true, lastLocationUpdateAt: true },
    });

    try {
        const { emitDriverLocationUpdate } = await import("../../utils/socketService.js");
        const io = req.app.get("io") || global.io;
        if (io) emitDriverLocationUpdate(io, req.user.id, updated);
    } catch (_) {}

    return successResponse(
        res,
        {
            user_id: updated.id,
            latitude: updated.latitude,
            longitude: updated.longitude,
            lastUpdatedAt: updated.lastLocationUpdateAt,
        },
        "Location updated"
    );
});

// ─── Registration Status Check ───────────────────────────────────────────────
export const getRegistrationStatus = asyncHandler(async (req, res) => {
    const driver = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            status: true,
            isVerified: true,
            isVerifiedDriver: true,
            rejectionReason: true,
            driverDocuments: {
                include: { document: { select: { id: true, name: true, nameAr: true, isRequired: true } } },
            },
        },
    });
    if (!driver) return errorResponse(res, "Driver not found", 404);

    const requiredDocs = await prisma.document.findMany({ where: { isRequired: true, status: 1 } });
    const uploadedDocIds = driver.driverDocuments.map((d) => d.documentId);
    const missingDocs = requiredDocs.filter((d) => !uploadedDocIds.includes(d.id));
    const unverifiedDocs = driver.driverDocuments.filter((d) => !d.isVerified);

    // Mobile treats isVerified as "account ok"; for drivers, admin approval sets isVerifiedDriver — align both in response
    const verifiedForDriver = driver.isVerified || driver.isVerifiedDriver;
    return successResponse(res, {
        status: driver.status,
        isVerified: verifiedForDriver,
        isVerifiedDriver: driver.isVerifiedDriver,
        rejectionReason: driver.status === 'inactive' ? driver.rejectionReason : null,
        documents: driver.driverDocuments,
        missingRequiredDocuments: missingDocs,
        unverifiedDocuments: unverifiedDocs,
        canDrive: driver.status === "active" && driver.isVerifiedDriver && missingDocs.length === 0,
    });
});

// ─── Get Rejection Status (Dedicated Endpoint) ───────────────────────────────
export const getRejectionStatus = asyncHandler(async (req, res) => {
    const driver = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            status: true,
            rejectionReason: true,
        },
    });
    if (!driver) return errorResponse(res, "Driver not found", 404);

    return successResponse(res, {
        isRejected: driver.status === 'inactive',
        rejectionReason: driver.rejectionReason || null,
        canReapply: driver.status === 'inactive',
    });
});

// ─── Get Current Status ────────────────────────────────────────────────────
export const getMyStatus = asyncHandler(async (req, res) => {
    const driver = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
            id: true,
            isOnline: true,
            isAvailable: true,
            latitude: true,
            longitude: true,
            currentHeading: true,
            lastLocationUpdateAt: true,
            lastActivedAt: true,
        },
    });
    if (!driver) return errorResponse(res, "Driver not found", 404);
    return successResponse(res, driver);
});

// ─── Go Online/Offline (Toggle) ───────────────────────────────────────────────
export const goOnlineOffline = asyncHandler(async (req, res) => {
    const driver = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { isOnline: true },
    });

    if (!driver) return errorResponse(res, "Driver not found", 404);

    const newStatus = !driver.isOnline;

    const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
            isOnline: newStatus,
            isAvailable: newStatus,
            lastActivedAt: newStatus ? new Date() : undefined,
        },
        select: {
            id: true,
            isOnline: true,
            isAvailable: true,
        },
    });

    if (newStatus) {
        try {
            const io = req.app.get("io") || global.io;
            if (io) {
                const loc = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { latitude: true, longitude: true },
                });
                const lat = loc?.latitude != null ? parseFloat(loc.latitude) : NaN;
                const lng = loc?.longitude != null ? parseFloat(loc.longitude) : NaN;
                if (Number.isFinite(lat) && Number.isFinite(lng)) {
                    setImmediate(() => {
                        replayPendingRidesForDriver(io, req.user.id, lat, lng).catch(() => {});
                    });
                }
            }
        } catch (_) {}
    }

    const message = newStatus ? "You are now online" : "You are now offline";
    return successResponse(res, updated, message);
});
