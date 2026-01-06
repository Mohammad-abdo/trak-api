import axios from "axios";
import admin from "firebase-admin";

/**
 * Initialize Firebase Admin (if not already initialized)
 */
let firebaseInitialized = false;

const initializeFirebase = () => {
    if (firebaseInitialized) return;

    try {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (serviceAccount) {
            const serviceAccountJson = JSON.parse(serviceAccount);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccountJson),
            });
            firebaseInitialized = true;
        } else if (process.env.FIREBASE_CREDENTIALS_PATH) {
            admin.initializeApp({
                credential: admin.credential.cert(process.env.FIREBASE_CREDENTIALS_PATH),
            });
            firebaseInitialized = true;
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
};

/**
 * Send push notification via OneSignal
 */
export const sendOneSignalNotification = async (playerIds, title, message, data = {}, imageUrl = null) => {
    try {
        const appId = process.env.ONESIGNAL_APP_ID || process.env.DRIVER_APP_ID;
        const restApiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.DRIVER_REST_API_KEY;

        if (!appId || !restApiKey) {
            throw new Error("OneSignal credentials not configured");
        }

        if (!Array.isArray(playerIds) || playerIds.length === 0) {
            return { success: false, message: "No player IDs provided" };
        }

        const payload = {
            app_id: appId,
            include_player_ids: playerIds,
            headings: { en: title },
            contents: { en: message },
            data: data,
        };

        if (imageUrl) {
            payload.big_picture = imageUrl;
        }

        const response = await axios.post("https://onesignal.com/api/v1/notifications", payload, {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${restApiKey}`,
            },
        });

        return {
            success: true,
            data: response.data,
        };
    } catch (error) {
        console.error("OneSignal notification error:", error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data?.errors?.[0] || error.message,
        };
    }
};

/**
 * Send push notification via Firebase Cloud Messaging
 */
export const sendFCMNotification = async (fcmTokens, title, message, data = {}, imageUrl = null) => {
    try {
        initializeFirebase();

        if (!firebaseInitialized) {
            throw new Error("Firebase not initialized");
        }

        if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
            return { success: false, message: "No FCM tokens provided" };
        }

        const payload = {
            notification: {
                title: title,
                body: message,
            },
            data: {
                ...data,
                title: title,
                body: message,
            },
            android: {
                priority: "high",
            },
            apns: {
                headers: {
                    "apns-priority": "10",
                },
            },
        };

        if (imageUrl) {
            payload.notification.imageUrl = imageUrl;
        }

        // Send to multiple tokens
        const messaging = admin.messaging();
        const response = await messaging.sendEachForMulticast({
            tokens: fcmTokens,
            ...payload,
        });

        return {
            success: response.successCount > 0,
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses,
        };
    } catch (error) {
        console.error("FCM notification error:", error);
        return {
            success: false,
            message: error.message,
        };
    }
};

/**
 * Send notification to user(s) - tries both OneSignal and FCM
 */
export const sendNotificationToUsers = async (users, title, message, data = {}, imageUrl = null) => {
    const results = {
        onesignal: { success: false, sent: 0 },
        fcm: { success: false, sent: 0 },
    };

    // Collect player IDs and FCM tokens
    const playerIds = [];
    const fcmTokens = [];

    users.forEach((user) => {
        if (user.playerId) {
            playerIds.push(user.playerId);
        }
        if (user.fcmToken) {
            fcmTokens.push(user.fcmToken);
        }
    });

    // Send via OneSignal
    if (playerIds.length > 0) {
        const onesignalResult = await sendOneSignalNotification(playerIds, title, message, data, imageUrl);
        results.onesignal = {
            success: onesignalResult.success,
            sent: onesignalResult.success ? playerIds.length : 0,
            error: onesignalResult.message,
        };
    }

    // Send via FCM
    if (fcmTokens.length > 0) {
        const fcmResult = await sendFCMNotification(fcmTokens, title, message, data, imageUrl);
        results.fcm = {
            success: fcmResult.success,
            sent: fcmResult.successCount || 0,
            error: fcmResult.message,
        };
    }

    return results;
};

/**
 * Save notification to database
 */
export const saveNotification = async (userId, type, data, notifiableType = "User") => {
    try {
        const prisma = (await import("../utils/prisma.js")).default;
        
        await prisma.notification.create({
            data: {
                type: type,
                notifiableType: notifiableType,
                notifiableId: userId,
                data: data,
                isRead: false,
            },
        });

        return { success: true };
    } catch (error) {
        console.error("Save notification error:", error);
        return { success: false, message: error.message };
    }
};

