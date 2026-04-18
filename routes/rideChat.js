import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
    getMessages,
    sendMessage,
    markRead,
    getUnreadCount,
} from "../controllers/chat/rideChatController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Ride Chat
 *     description: |
 *       1-to-1 chat between the rider (client) and the assigned driver of a
 *       ride. Chat becomes available **after the driver accepts the trip**
 *       (`status` in `accepted`, `arrived`, `started`, `ongoing`, `in_progress`).
 *       History remains readable after `completed` / `cancelled` but new
 *       messages are rejected with **403 `CHAT_NOT_OPEN`**.
 *
 *       **Real-time:** subscribe to the existing Socket.IO room
 *       `ride-{rideId}` (via `subscribe-ride`) to receive:
 *       - `chat:message` — new message persisted
 *       - `chat:read`    — someone read your messages
 *       - `chat:typing`  — typing indicator (ephemeral)
 */

/**
 * @swagger
 * /apimobile/chat/rides/{rideId}/messages:
 *   get:
 *     tags: [Ride Chat]
 *     summary: Get paginated chat history for a ride
 *     description: |
 *       Returns messages in chronological order (oldest → newest inside the
 *       page). Use `nextCursor` to fetch older messages. Both the rider and
 *       the assigned driver can call this. Admins/staff are not accepted on
 *       this endpoint (they have their own admin views).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         description: RideRequest id.
 *         schema: { type: integer, example: 921 }
 *       - in: query
 *         name: limit
 *         description: Page size, max 100.
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 30 }
 *       - in: query
 *         name: cursor
 *         description: Pass the previous response's `nextCursor` to load older messages.
 *         schema: { type: integer, example: 184 }
 *     responses:
 *       200:
 *         description: Chat history fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: Chat history fetched }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer, example: 921 }
 *                     status:        { type: string,  example: accepted }
 *                     senderType:    { type: string, enum: [rider, driver], example: rider }
 *                     messages:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/RideChatMessage' }
 *                     nextCursor:
 *                       type: integer
 *                       nullable: true
 *                       description: Pass as `cursor` to fetch older messages. `null` when no more.
 *                       example: 155
 *             examples:
 *               default:
 *                 summary: Two messages returned (rider viewpoint)
 *                 value:
 *                   success: true
 *                   message: Chat history fetched
 *                   data:
 *                     rideRequestId: 921
 *                     status: accepted
 *                     senderType: rider
 *                     nextCursor: null
 *                     messages:
 *                       - id: 184
 *                         rideRequestId: 921
 *                         senderId: 12
 *                         senderType: rider
 *                         message: I am waiting at the main gate, blue shirt.
 *                         attachmentUrl: null
 *                         isRead: true
 *                         readAt: '2026-04-18T12:45:20.000Z'
 *                         createdAt: '2026-04-18T12:45:03.512Z'
 *                       - id: 185
 *                         rideRequestId: 921
 *                         senderId: 47
 *                         senderType: driver
 *                         message: On my way, 3 minutes.
 *                         attachmentUrl: null
 *                         isRead: false
 *                         readAt: null
 *                         createdAt: '2026-04-18T12:45:17.004Z'
 *       400:
 *         description: Invalid ride id
 *         content:
 *           application/json:
 *             example: { success: false, message: Invalid ride id }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             example: { success: false, message: No token provided, authorization denied }
 *       403:
 *         description: Caller is not a participant of this ride, or chat not available yet
 *         content:
 *           application/json:
 *             examples:
 *               notParticipant:
 *                 value: { success: false, message: You are not a participant of this ride }
 *               notAvailable:
 *                 value: { success: false, message: Chat history is not available for this ride }
 *       404:
 *         description: Ride not found
 *         content:
 *           application/json:
 *             example: { success: false, message: Ride not found }
 *   post:
 *     tags: [Ride Chat]
 *     summary: Send a chat message in a ride
 *     description: |
 *       Persists the message and broadcasts `chat:message` to the Socket.IO
 *       room `ride-{rideId}`. Rate-limited to **20 messages / 10 seconds**
 *       per user per ride. Message length capped at **2000** chars (longer
 *       messages are truncated).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: integer, example: 921 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *                 example: Please wait 2 more minutes, I am coming.
 *               attachmentUrl:
 *                 type: string
 *                 nullable: true
 *                 description: Optional public URL for an attached image/file (v2).
 *                 example: null
 *           examples:
 *             text:
 *               summary: Plain text message
 *               value: { message: Please wait 2 more minutes, I am coming. }
 *     responses:
 *       201:
 *         description: Message sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: Message sent }
 *                 data:    { $ref: '#/components/schemas/RideChatMessage' }
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   message: Message sent
 *                   data:
 *                     id: 186
 *                     rideRequestId: 921
 *                     senderId: 12
 *                     senderType: rider
 *                     message: Please wait 2 more minutes, I am coming.
 *                     attachmentUrl: null
 *                     isRead: false
 *                     readAt: null
 *                     createdAt: '2026-04-18T12:46:10.112Z'
 *       400:
 *         description: Invalid payload
 *         content:
 *           application/json:
 *             example: { success: false, message: Message is required and must be 1..2000 chars }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             example: { success: false, message: No token provided, authorization denied }
 *       403:
 *         description: Not a participant, or chat is not open for this status
 *         content:
 *           application/json:
 *             examples:
 *               notOpen:
 *                 summary: Ride not accepted yet / already completed
 *                 value: { success: false, message: Chat is not available for this ride yet }
 *               notParticipant:
 *                 value: { success: false, message: You are not a participant of this ride }
 *       404:
 *         description: Ride not found
 *         content:
 *           application/json:
 *             example: { success: false, message: Ride not found }
 *       429:
 *         description: Rate limit hit (20 messages / 10 seconds per ride)
 *         content:
 *           application/json:
 *             example: { success: false, message: Too many messages, please slow down }
 */
router.get("/rides/:rideId/messages", authenticate, getMessages);
router.post("/rides/:rideId/messages", authenticate, sendMessage);

/**
 * @swagger
 * /apimobile/chat/rides/{rideId}/read:
 *   post:
 *     tags: [Ride Chat]
 *     summary: Mark all incoming messages in this ride as read
 *     description: |
 *       Marks every unread message addressed to the caller (i.e. sent by the
 *       other participant) as read and emits `chat:read` on the `ride-{rideId}`
 *       room so the sender's UI can flip the delivery indicator.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: integer, example: 921 }
 *     responses:
 *       200:
 *         description: Messages marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: Messages marked as read }
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated: { type: integer, example: 3 }
 *             examples:
 *               default:
 *                 value: { success: true, message: Messages marked as read, data: { updated: 3 } }
 *               nothingToUpdate:
 *                 value: { success: true, message: Messages marked as read, data: { updated: 0 } }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             example: { success: false, message: No token provided, authorization denied }
 *       403:
 *         description: Not a participant of this ride
 *         content:
 *           application/json:
 *             example: { success: false, message: You are not a participant of this ride }
 *       404:
 *         description: Ride not found
 *         content:
 *           application/json:
 *             example: { success: false, message: Ride not found }
 *
 * /apimobile/chat/rides/{rideId}/unread-count:
 *   get:
 *     tags: [Ride Chat]
 *     summary: Get the unread message count for the badge
 *     description: Returns the number of messages sent by the other party that the current user has not yet read.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: integer, example: 921 }
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: Unread count }
 *                 data:
 *                   type: object
 *                   properties:
 *                     rideRequestId: { type: integer, example: 921 }
 *                     unread:        { type: integer, example: 2 }
 *             examples:
 *               someUnread:
 *                 value: { success: true, message: Unread count, data: { rideRequestId: 921, unread: 2 } }
 *               allRead:
 *                 value: { success: true, message: Unread count, data: { rideRequestId: 921, unread: 0 } }
 *       401:
 *         description: Missing or invalid token
 *         content:
 *           application/json:
 *             example: { success: false, message: No token provided, authorization denied }
 *       403:
 *         description: Not a participant of this ride
 *         content:
 *           application/json:
 *             example: { success: false, message: You are not a participant of this ride }
 *       404:
 *         description: Ride not found
 *         content:
 *           application/json:
 *             example: { success: false, message: Ride not found }
 */
router.post("/rides/:rideId/read", authenticate, markRead);
router.get("/rides/:rideId/unread-count", authenticate, getUnreadCount);

export default router;
