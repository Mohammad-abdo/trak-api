/**
 * Socket.IO handlers for ride-chat.
 *
 * Reuses the already-existing `ride-{rideId}` room defined in server.js so
 * we do NOT need a new connection lifecycle. This module only registers a
 * few additional event listeners on each connected socket.
 *
 * Events (client -> server):
 *   - "chat:send"    { rideRequestId, message, attachmentUrl? }
 *   - "chat:typing"  { rideRequestId, isTyping }
 *   - "chat:read-ack"{ rideRequestId }
 *
 * Events (server -> room `ride-{rideId}`):
 *   - "chat:message" (full persisted message row)
 *   - "chat:typing"  { senderId, senderType, isTyping }
 *   - "chat:read"    { rideRequestId, readerId, readerType, count, readAt }
 *
 * **Mobile apps:** use this socket path as the **primary** way to send/receive
 * chat while the trip is open, so UI updates in real time. REST `POST .../messages`
 * remains a fallback; both paths persist and emit `chat:message` to `ride-{id}`.
 */

import prisma from "./prisma.js";
import { emitToRide } from "./socketService.js";
import {
    resolveRideChatAccess,
    checkChatRateLimit,
    sanitizeChatMessage,
} from "./rideChatAuth.js";

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

function currentSocketUser(socket) {
    const user = socket.data?.user;
    if (!user || !user.id) return null;
    return { id: user.id, userType: user.userType };
}

export function registerRideChatHandlers(socket, io) {
    socket.on("chat:send", async (payload) => {
        try {
            const user = currentSocketUser(socket);
            if (!user) {
                socket.emit("chat:error", { code: "UNAUTHENTICATED", message: "Socket not authenticated" });
                return;
            }

            const { rideRequestId, message: rawMessage, attachmentUrl } = payload || {};
            const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: true });
            if (!access.ok) {
                socket.emit("chat:error", { code: access.code, message: access.message });
                return;
            }

            const message = sanitizeChatMessage(rawMessage);
            if (!message) {
                socket.emit("chat:error", { code: "INVALID_MESSAGE", message: "Message is required" });
                return;
            }

            const rate = checkChatRateLimit(user.id, access.ride.id);
            if (!rate.ok) {
                socket.emit("chat:error", { code: "RATE_LIMITED", message: "Too many messages" });
                return;
            }

            const saved = await prisma.rideChatMessage.create({
                data: {
                    rideRequestId: access.ride.id,
                    senderId: user.id,
                    senderType: access.senderType,
                    message,
                    attachmentUrl:
                        typeof attachmentUrl === "string" && attachmentUrl.trim()
                            ? attachmentUrl.trim()
                            : null,
                },
                select: SELECT_MESSAGE,
            });

            emitToRide(io, access.ride.id, "chat:message", saved);
        } catch (err) {
            console.error("chat:send error:", err);
            socket.emit("chat:error", { code: "INTERNAL", message: "Failed to send message" });
        }
    });

    socket.on("chat:typing", async (payload) => {
        try {
            const user = currentSocketUser(socket);
            if (!user) return;
            const { rideRequestId, isTyping } = payload || {};
            const access = await resolveRideChatAccess(user, rideRequestId, { requireWrite: true });
            if (!access.ok) return;

            io.to(`ride-${access.ride.id}`).except(socket.id).emit("chat:typing", {
                rideRequestId: access.ride.id,
                senderId: user.id,
                senderType: access.senderType,
                isTyping: Boolean(isTyping),
            });
        } catch (_) {
            // Typing is best-effort; swallow errors silently.
        }
    });

    socket.on("chat:read-ack", async (payload) => {
        try {
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
                },
                data: { isRead: true, readAt: now },
            });

            if (result.count > 0) {
                emitToRide(io, access.ride.id, "chat:read", {
                    rideRequestId: access.ride.id,
                    readerId: user.id,
                    readerType: access.senderType,
                    count: result.count,
                    readAt: now.toISOString(),
                });
            }
        } catch (err) {
            console.error("chat:read-ack error:", err);
        }
    });
}
