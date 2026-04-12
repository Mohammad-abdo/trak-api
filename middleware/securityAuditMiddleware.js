import prisma from "../utils/prisma.js";
import { getRequestNetworkMeta } from "../utils/clientIp.js";

function stripPath(urlPath) {
    if (!urlPath) return "";
    const q = urlPath.indexOf("?");
    return q >= 0 ? urlPath.slice(0, q) : urlPath;
}

/**
 * @returns {{ category: string; metadata?: object } | null}
 */
export function classifyAuditRoute(method, pathOnly) {
    const p = pathOnly || "";

    if (p.startsWith("/api/demand-map")) {
        return { category: "map", metadata: {} };
    }

    if (p.startsWith("/api/payments")) {
        const meta = {};
        return { category: "payment", metadata: meta };
    }

    if (method === "POST" && (p === "/api/rides/schedule" || p.endsWith("/rides/schedule"))) {
        return { category: "payment", metadata: { flow: "scheduled_ride" } };
    }

    const otpPrefixes = ["/api/auth", "/apimobile/user/auth", "/apimobile/driver/auth"];
    for (const prefix of otpPrefixes) {
        if (!p.startsWith(prefix)) continue;
        if (
            p.includes("submit-otp") ||
            p.includes("resend-otp") ||
            p.includes("send-otp") ||
            p.includes("forgot-password") ||
            p.includes("reset-password")
        ) {
            return { category: "otp", metadata: {} };
        }
    }

    return null;
}

function safePaymentMetadata(body) {
    if (!body || typeof body !== "object") return {};
    const out = {};
    if (body.rideRequestId != null) out.rideRequestId = body.rideRequestId;
    if (body.paymentType != null) out.paymentType = String(body.paymentType);
    if (body.paymentGateway != null) out.paymentGateway = String(body.paymentGateway);
    return out;
}

/**
 * Persists allowlisted requests when SECURITY_AUDIT_LOG_ENABLED=1.
 * Never stores raw OTP, passwords, or card numbers.
 */
export function securityAuditMiddleware(req, res, next) {
    if (process.env.SECURITY_AUDIT_LOG_ENABLED !== "1") {
        return next();
    }

    const pathOnly = stripPath(req.originalUrl || req.url || "");
    const classified = classifyAuditRoute(req.method, pathOnly);
    if (!classified) {
        return next();
    }

    const { ip, forwardedFor, userAgent } = getRequestNetworkMeta(req);
    let metadata = { ...classified.metadata };
    if (classified.category === "payment" && req.body && typeof req.body === "object") {
        metadata = { ...metadata, ...safePaymentMetadata(req.body) };
    }

    res.on("finish", () => {
        prisma.securityAuditLog
            .create({
                data: {
                    category: classified.category,
                    userId: req.user?.id ?? null,
                    userType: req.user?.userType ?? null,
                    ip: ip || null,
                    forwardedFor: forwardedFor || null,
                    userAgent,
                    method: req.method,
                    route: pathOnly.slice(0, 512),
                    requestId: req.requestId ?? null,
                    statusCode: res.statusCode,
                    metadata: Object.keys(metadata).length ? metadata : undefined,
                },
            })
            .catch((err) => console.error("securityAuditLog:", err.message));
    });

    next();
}
