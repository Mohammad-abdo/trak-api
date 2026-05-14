/**
 * Socket.IO handlers for ride-chat.
 *
 * Room: `ride-{rideId}` — join via `subscribe-ride` or Flutter `joinChat` (see server.js).
 *
 * Client -> server (legacy):
 *   - "chat:send"      { rideRequestId, message, attachmentUrl? }
 *   - "chat:typing"    { rideRequestId, isTyping }
 *   - "chat:read-ack"  { rideRequestId }
 *
 * Client -> server (Flutter aliases):
 *   - "sendMessage"    same as chat:send
 *   - "sendImage"    requires attachmentUrl; message optional (defaults to "[image]")
 *   - "sendVoice"    requires attachmentUrl; message optional (defaults to "[voice]")
 *   - "typing" / "stopTyping"  -> isTyping true/false (also emits legacy + userTyping)
 *   - "messageSeen"  same as chat:read-ack
 *   - "deleteMessage" { rideRequestId, messageId } — soft-delete (sender only, 15m window)
 *   - "messageDelivered" { rideRequestId, messageIds: number[] } — recipient only
 *
 * Server -> room `ride-{rideId}`:
 *   - "chat:message" | "newMessage"  (persisted row)
 *   - "newAttachment"                (when attachmentUrl set; subset for convenience)
 *   - "chat:typing" | "userTyping"   { rideRequestId, senderId, senderType, isTyping }
 *   - "chat:read" | "messageSeenUpdated"
 *   - "messageDeleted" | "chat:message-deleted"
 *   - "messageDeliveredUpdated" | "chat:message-delivered"
 *   - "chat:error" -> sender only
 */

import prisma from "./prisma.js";
import {
    resolveRideChatAccess,
    checkChatRateLimit,
    sanitizeChatMessage,
} from "./rideChatAuth.js";
import {
    emitNewChatMessage,
    emitChatRead,
    emitChatTypingToOthers,
    emitMessageDeleted,
    emitMessageDeliveredUpdated,
} from "./rideChatBroadcast.js";

const SELECT_MESSAGE = {
    id: true,
    rideRequestId: true,
    senderId: true,
    senderType: true,
    message: true,
    attachmentUrl: true,
    isRead: true,
    readAt: true,
    deliveredAt: true,
    deletedAt: true,
    deletedByUserId: true,
    createdAt: true,
};

const DELETE_MESSAGE_MAX_AGE_MS = 15 * 60 * 1000;

function currentSocketUser(socket) {
    const user = socket.data?.user;
    if (!user || !user.id) return null;
    return { id: user.id, userType: user.userType };
}

function normalizeAttachmentUrl(v) {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Effective text body: sanitize user text or placeholder when only attachment. */
function resolveOutgoingMessage(rawMessage, attachmentUrl, fallbackLabel) {
    const att = normalizeAttachmentUrl(attachmentUrl);
    const sanitized = sanitizeChatMessage(typeof rawMessage === "string" ? rawMessage : "");
    if (sanitized) return sanitized;
    if (att) return fallbackLabel || "[attachment]";
    return null;
}

async function persistAndBroadcastMessage(io, user, access, messageText, attachmentUrl) {
    const saved = await prisma.rideChatMessage.create({
        data: {
            rideRequestId: access.ride.id,
            senderId: user.id,
            senderType: access.senderType,
            message: messageText,
            attachmentUrl,
        },
        select: SELECT_MESSAGE,
    });
    emitNewChatMessage(io, access.ride.id, saved);
    return saved;
}

async function handleChatSend(socket, io, payload, opts = {}) {
    const user = currentSocketUser(socket);
    if (!user) {
        socket.emit("chat:error", { code: "UNAUTHENTICATED", message: "Socket not authenticated" });
        return;
    }

    const { rideRequestId, message: rawMessage, attachmentUrl: rawAtt } = payload || {};
    const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: true });
    if (!access.ok) {
        socket.emit("chat:error", { code: access.code, message: access.message });
        return;
    }

    const attachmentUrl = normalizeAttachmentUrl(rawAtt);
    const messageText = resolveOutgoingMessage(rawMessage, attachmentUrl, opts.fallbackMessage);
    if (!messageText) {
        socket.emit("chat:error", { code: "INVALID_MESSAGE", message: "Message is required" });
        return;
    }

    const rate = checkChatRateLimit(user.id, access.ride.id);
    if (!rate.ok) {
        socket.emit("chat:error", { code: "RATE_LIMITED", message: "Too many messages" });
        return;
    }

    await persistAndBroadcastMessage(io, user, access, messageText, attachmentUrl);
}

async function handleTyping(socket, io, payload, isTyping) {
    const user = currentSocketUser(socket);
    if (!user) return;
    const { rideRequestId } = payload || {};
    const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: true });
    if (!access.ok) return;

    const body = {
        rideRequestId: access.ride.id,
        senderId: user.id,
        senderType: access.senderType,
        isTyping: Boolean(isTyping),
    };
    emitChatTypingToOthers(io, access.ride.id, body, socket.id);
}

async function handleReadAck(socket, io, payload) {
    const user = currentSocketUser(socket);
    if (!user) return;
    const { rideRequestId } = payload || {};
    const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: false });
    if (!access.ok) return;

    const otherSenderType = access.senderType === "driver" ? "rider" : "driver";
    const now = new Date();
    const result = await prisma.rideChatMessage.updateMany({
        where: {
            rideRequestId: access.ride.id,
            senderType: otherSenderType,
            isRead: false,
            deletedAt: null,
        },
        data: { isRead: true, readAt: now },
    });

    if (result.count > 0) {
        emitChatRead(io, access.ride.id, {
            rideRequestId: access.ride.id,
            readerId: user.id,
            readerType: access.senderType,
            count: result.count,
            readAt: now.toISOString(),
        });
    }
}

async function handleDeleteMessage(socket, io, payload) {
    try {
        const user = currentSocketUser(socket);
        if (!user) {
            socket.emit("chat:error", { code: "UNAUTHENTICATED", message: "Socket not authenticated" });
            return;
        }
        const rideRequestId = payload?.rideRequestId ?? payload?.rideId;
        const messageId = parseInt(String(payload?.messageId ?? payload?.message_id ?? ""), 10);
        if (!Number.isFinite(messageId)) {
            socket.emit("chat:error", { code: "INVALID_MESSAGE_ID", message: "messageId is required" });
            return;
        }

        const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: true });
        if (!access.ok) {
            socket.emit("chat:error", { code: access.code, message: access.message });
            return;
        }

        const row = await prisma.rideChatMessage.findFirst({
            where: { id: messageId, rideRequestId: access.ride.id, deletedAt: null },
            select: { id: true, senderId: true, createdAt: true },
        });
        if (!row) {
            socket.emit("chat:error", { code: "NOT_FOUND", message: "Message not found" });
            return;
        }
        if (Number(row.senderId) !== Number(user.id)) {
            socket.emit("chat:error", { code: "FORBIDDEN", message: "You can only delete your own messages" });
            return;
        }
        const age = Date.now() - new Date(row.createdAt).getTime();
        if (age > DELETE_MESSAGE_MAX_AGE_MS) {
            socket.emit("chat:error", { code: "DELETE_WINDOW", message: "Message is too old to delete" });
            return;
        }

        const now = new Date();
        await prisma.rideChatMessage.update({
            where: { id: messageId },
            data: { deletedAt: now, deletedByUserId: user.id },
        });

        emitMessageDeleted(io, access.ride.id, {
            rideRequestId: access.ride.id,
            messageId,
            deletedAt: now.toISOString(),
            deletedByUserId: user.id,
        });
    } catch (err) {
        console.error("deleteMessage error:", err);
        socket.emit("chat:error", { code: "INTERNAL", message: "Failed to delete message" });
    }
}

async function handleMessageDelivered(socket, io, payload) {
    try {
        const user = currentSocketUser(socket);
        if (!user) {
            socket.emit("chat:error", { code: "UNAUTHENTICATED", message: "Socket not authenticated" });
            return;
        }
        const rideRequestId = payload?.rideRequestId ?? payload?.rideId;
        const idsRaw = payload?.messageIds ?? payload?.message_ids;
        const messageIds = Array.isArray(idsRaw)
            ? idsRaw.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n))
            : [];
        if (!messageIds.length) {
            socket.emit("chat:error", { code: "INVALID_PAYLOAD", message: "messageIds (array) is required" });
            return;
        }

        const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: false });
        if (!access.ok) {
            socket.emit("chat:error", { code: access.code, message: access.message });
            return;
        }

        const now = new Date();
        const result = await prisma.rideChatMessage.updateMany({
            where: {
                id: { in: messageIds },
                rideRequestId: access.ride.id,
                senderId: { not: user.id },
                deletedAt: null,
            },
            data: { deliveredAt: now },
        });

        if (result.count > 0) {
            emitMessageDeliveredUpdated(io, access.ride.id, {
                rideRequestId: access.ride.id,
                messageIds,
                deliveredAt: now.toISOString(),
                count: result.count,
            });
        }
    } catch (err) {
        console.error("messageDelivered error:", err);
        socket.emit("chat:error", { code: "INTERNAL", message: "Failed to mark delivered" });
    }
}

export function registerRideChatHandlers(socket, io) {
    socket.on("chat:send", async (payload) => {
        try {
            await handleChatSend(socket, io, payload, {});
        } catch (err) {
            console.error("chat:send error:", err);
            socket.emit("chat:error", { code: "INTERNAL", message: "Failed to send message" });
        }
    });

    socket.on("sendMessage", async (payload) => {
        try {
            await handleChatSend(socket, io, payload, {});
        } catch (err) {
            console.error("sendMessage error:", err);
            socket.emit("chat:error", { code: "INTERNAL", message: "Failed to send message" });
        }
    });

    socket.on("sendImage", async (payload) => {
        try {
            if (!normalizeAttachmentUrl((payload || {}).attachmentUrl)) {
                socket.emit("chat:error", { code: "INVALID_ATTACHMENT", message: "attachmentUrl is required" });
                return;
            }
            await handleChatSend(socket, io, payload, { fallbackMessage: "[image]" });
        } catch (err) {
            console.error("sendImage error:", err);
            socket.emit("chat:error", { code: "INTERNAL", message: "Failed to send image" });
        }
    });

    socket.on("sendVoice", async (payload) => {
        try {
            if (!normalizeAttachmentUrl((payload || {}).attachmentUrl)) {
                socket.emit("chat:error", { code: "INVALID_ATTACHMENT", message: "attachmentUrl is required" });
                return;
            }
            await handleChatSend(socket, io, payload, { fallbackMessage: "[voice]" });
        } catch (err) {
            console.error("sendVoice error:", err);
            socket.emit("chat:error", { code: "INTERNAL", message: "Failed to send voice" });
        }
    });

    socket.on("chat:typing", async (payload) => {
        try {
            await handleTyping(socket, io, payload, Boolean((payload || {}).isTyping));
        } catch (_) {
            // best-effort
        }
    });

    socket.on("typing", async (payload) => {
        try {
            await handleTyping(socket, io, payload, true);
        } catch (_) {}
    });

    socket.on("stopTyping", async (payload) => {
        try {
            await handleTyping(socket, io, payload, false);
        } catch (_) {}
    });

    socket.on("chat:read-ack", async (payload) => {
        try {
            await handleReadAck(socket, io, payload);
        } catch (err) {
            console.error("chat:read-ack error:", err);
        }
    });

    socket.on("messageSeen", async (payload) => {
        try {
            await handleReadAck(socket, io, payload);
        } catch (err) {
            console.error("messageSeen error:", err);
        }
    });

    socket.on("deleteMessage", async (payload) => {
        await handleDeleteMessage(socket, io, payload);
    });

    socket.on("messageDelivered", async (payload) => {
        await handleMessageDelivered(socket, io, payload);
    });
}
