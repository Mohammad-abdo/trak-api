import { saveAdminNotification } from "./notificationService.js";

export const PAYSKY_NOTIFICATION_PATH = "/api/payments/paysky/notification";

/** Legacy / alternate PaySky dashboard URL — mounted to the same POST handler as PAYSKY_NOTIFICATION_PATH. */
export const PAYSKY_WALLET_NOTIFICATION_PATH = "/api/payments/paysky/wallet-notification";

/**
 * Full webhook URL from env (for PaySky dashboard / .env documentation).
 * PAYSKY_WEBHOOK_URL wins; else PAYSKY_PUBLIC_API_BASE_URL + path.
 */
export function getConfiguredPayskyWebhookUrl() {
    const explicit = String(process.env.PAYSKY_WEBHOOK_URL || "").trim();
    if (explicit) return explicit;
    const base = String(process.env.PAYSKY_PUBLIC_API_BASE_URL || "")
        .trim()
        .replace(/\/+$/, "");
    if (base) return `${base}${PAYSKY_NOTIFICATION_PATH}`;
    return null;
}

export function buildPayskyWebhookUrlFromRequest(req) {
    const protoRaw = req.get("x-forwarded-proto") || req.protocol || "http";
    const protocol = String(protoRaw).split(",")[0].trim() || "http";
    const hostRaw = req.get("x-forwarded-host") || req.get("host") || "";
    const host = String(hostRaw).split(",")[0].trim();
    return host ? `${protocol}://${host}${PAYSKY_NOTIFICATION_PATH}` : null;
}

function authFailuresNotifyEnabled() {
    return String(process.env.PAYSKY_NOTIFY_AUTH_FAILURES || "").trim() === "1";
}

/**
 * Log invalid signature / merchant / terminal to admin notifications (off by default — set PAYSKY_NOTIFY_AUTH_FAILURES=1).
 */
export async function notifyPayskyWebhookAuthFailure(kind) {
    if (!authFailuresNotifyEnabled()) return;
    try {
        await saveAdminNotification("paysky_webhook", {
            outcome: "failed",
            title: "PaySky: webhook rejected",
            titleAr: "PaySky: تم رفض الويب هوك",
            message: `Authentication failed (${kind}).`,
            messageAr: `فشل التحقق (${kind}).`,
            link: "/payments/paysky-test",
        });
    } catch (err) {
        console.error("notifyPayskyWebhookAuthFailure:", err);
    }
}

/**
 * Record PaySky OMNI callback outcome for dashboard Admin Notifications.
 */
export async function notifyPayskyWebhookAdmin({
    success,
    titleEn,
    titleAr,
    messageEn,
    messageAr,
    rideRequestId,
    systemReference,
    txnType,
    actionCode,
}) {
    try {
        await saveAdminNotification("paysky_webhook", {
            outcome: success ? "success" : "failed",
            title: titleEn,
            titleAr: titleAr || titleEn,
            message: messageEn,
            messageAr: messageAr || messageEn,
            link:
                rideRequestId != null
                    ? `/ride-requests/${rideRequestId}`
                    : "/payments/paysky-test",
            rideRequestId: rideRequestId ?? undefined,
            systemReference: systemReference || undefined,
            txnType: txnType != null ? String(txnType) : undefined,
            actionCode: actionCode != null ? String(actionCode) : undefined,
        });
    } catch (err) {
        console.error("notifyPayskyWebhookAdmin:", err);
    }
}
