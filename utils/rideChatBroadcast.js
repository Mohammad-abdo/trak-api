/**
 * Dual emit: legacy `chat:*` names + Flutter `ChatSocketEvents` names.
 */

import { emitToRide } from "./socketService.js";

export function emitNewChatMessage(io, rideId, savedRow) {
    if (!io || !savedRow) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, "chat:message", savedRow);
    emitToRide(io, id, "newMessage", savedRow);
    if (savedRow.attachmentUrl) {
        emitToRide(io, id, "newAttachment", {
            rideRequestId: id,
            messageId: savedRow.id,
            attachmentUrl: savedRow.attachmentUrl,
            senderId: savedRow.senderId,
            senderType: savedRow.senderType,
            createdAt: savedRow.createdAt,
        });
    }
}

export function emitChatRead(io, rideId, readPayload) {
    if (!io || !readPayload) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, "chat:read", readPayload);
    emitToRide(io, id, "messageSeenUpdated", readPayload);
}

/**
 * Typing to all in ride room except sender (legacy + Flutter names).
 */
export function emitChatTypingToOthers(io, rideId, typingPayload, exceptSocketId) {
    if (!io || !typingPayload) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    const room = `ride-${id}`;
    io.to(room).except(exceptSocketId).emit("chat:typing", typingPayload);
    io.to(room).except(exceptSocketId).emit("userTyping", typingPayload);
}

export function emitMessageDeleted(io, rideId, body) {
    if (!io || !body) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, "messageDeleted", body);
    emitToRide(io, id, "chat:message-deleted", body);
}

export function emitMessageDeliveredUpdated(io, rideId, body) {
    if (!io || !body) return;
    const id = typeof rideId === "number" ? rideId : parseInt(String(rideId), 10);
    if (Number.isNaN(id)) return;
    emitToRide(io, id, "messageDeliveredUpdated", body);
    emitToRide(io, id, "chat:message-delivered", body);
}
