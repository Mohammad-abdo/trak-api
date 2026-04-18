import prisma from "../../utils/prisma.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/serverResponse.js";
import { emitToRide } from "../../utils/socketService.js";
import {
    resolveRideChatAccess,
    checkChatRateLimit,
    sanitizeChatMessage,
    CHAT_MESSAGE_MAX_LENGTH,
} from "../../utils/rideChatAuth.js";

const SELECT_MESSAGE = {
    id: true,
    rideRequestId: true,
    senderId: true,
    senderType: true,
    message: true,
    attachmentUrl: true,
    isRead: true,
    readAt: true,
    createdAt: true,
};

const getIo = (req) => req.app.get("io") || global.io || null;

// @desc    Get paginated chat history for a ride
// @route   GET /apimobile/chat/rides/:rideId/messages
// @access  Private (rider or assigned driver of the ride)
export const getMessages = asyncHandler(async (req, res) => {
    const access = await resolveRideChatAccess(req.user, req.params.rideId, { requireWrite: false });
    if (!access.ok) return errorResponse(res, access.message, access.statusCode);

    const limit = Math.min(Math.max(parseInt(req.query.limit ?? "30", 10) || 30, 1), 100);
    const cursorRaw = req.query.cursor;
    const cursorId = cursorRaw != null ? parseInt(String(cursorRaw), 10) : null;

    const messages = await prisma.rideChatMessage.findMany({
        where: { rideRequestId: access.ride.id },
        orderBy: { id: "desc" },
        take: limit + 1,
        ...(cursorId && !Number.isNaN(cursorId) ? { cursor: { id: cursorId }, skip: 1 } : {}),
        select: SELECT_MESSAGE,
    });

    let nextCursor = null;
    if (messages.length > limit) {
        const last = messages.pop();
        nextCursor = last ? last.id : null;
    }

    return successResponse(
        res,
        {
            rideRequestId: access.ride.id,
            status: access.ride.status,
            senderType: access.senderType,
            messages: messages.reverse(),
            nextCursor,
        },
        "Chat history fetched"
    );
});

// @desc    Send a chat message in a ride
// @route   POST /apimobile/chat/rides/:rideId/messages
// @access  Private (rider or assigned driver, only while ride is active)
export const sendMessage = asyncHandler(async (req, res) => {
    const access = await resolveRideChatAccess(req.user, req.params.rideId, { requireWrite: true });
    if (!access.ok) return errorResponse(res, access.message, access.statusCode);

    const message = sanitizeChatMessage(req.body?.message);
    if (!message) {
        return errorResponse(
            res,
            `Message is required and must be 1..${CHAT_MESSAGE_MAX_LENGTH} chars`,
            400
        );
    }

    const rate = checkChatRateLimit(req.user.id, access.ride.id);
    if (!rate.ok) {
        return errorResponse(res, "Too many messages, please slow down", 429);
    }

    const attachmentUrl =
        typeof req.body?.attachmentUrl === "string" && req.body.attachmentUrl.trim()
            ? req.body.attachmentUrl.trim()
            : null;

    const saved = await prisma.rideChatMessage.create({
        data: {
            rideRequestId: access.ride.id,
            senderId: req.user.id,
            senderType: access.senderType,
            message,
            attachmentUrl,
        },
        select: SELECT_MESSAGE,
    });

    const io = getIo(req);
    if (io) emitToRide(io, access.ride.id, "chat:message", saved);

    return successResponse(res, saved, "Message sent", 201);
});

// @desc    Mark all messages addressed to the current user as read
// @route   POST /apimobile/chat/rides/:rideId/read
// @access  Private (rider or assigned driver)
export const markRead = asyncHandler(async (req, res) => {
    const access = await resolveRideChatAccess(req.user, req.params.rideId, { requireWrite: false });
    if (!access.ok) return errorResponse(res, access.message, access.statusCode);

    const otherSenderType = access.senderType === "driver" ? "rider" : "driver";
    const now = new Date();

    const result = await prisma.rideChatMessage.updateMany({
        where: {
            rideRequestId: access.ride.id,
            senderType: otherSenderType,
            isRead: false,
        },
        data: { isRead: true, readAt: now },
    });

    const io = getIo(req);
    if (io && result.count > 0) {
        emitToRide(io, access.ride.id, "chat:read", {
            rideRequestId: access.ride.id,
            readerId: req.user.id,
            readerType: access.senderType,
            count: result.count,
            readAt: now.toISOString(),
        });
    }

    return successResponse(res, { updated: result.count }, "Messages marked as read");
});

// @desc    Unread message count for badge
// @route   GET /apimobile/chat/rides/:rideId/unread-count
// @access  Private (rider or assigned driver)
export const getUnreadCount = asyncHandler(async (req, res) => {
    const access = await resolveRideChatAccess(req.user, req.params.rideId, { requireWrite: false });
    if (!access.ok) return errorResponse(res, access.message, access.statusCode);

    const otherSenderType = access.senderType === "driver" ? "rider" : "driver";

    const count = await prisma.rideChatMessage.count({
        where: {
            rideRequestId: access.ride.id,
            senderType: otherSenderType,
            isRead: false,
        },
    });

    return successResponse(res, { rideRequestId: access.ride.id, unread: count }, "Unread count");
});
