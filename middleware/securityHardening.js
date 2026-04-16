const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_REQUESTS = 120;

function parsePositiveInt(value, fallback) {
    const n = parseInt(String(value ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Lightweight, in-memory rate limiter.
 * Designed to be optional and conservative so existing clients are not impacted under normal traffic.
 */
export function createIpRateLimiter({
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    enabled = true,
} = {}) {
    const buckets = new Map();
    let lastSweepAt = 0;
    const SWEEP_INTERVAL_MS = Math.max(windowMs, 30 * 1000);

    return (req, res, next) => {
        if (!enabled) return next();

        const now = Date.now();
        if (now - lastSweepAt >= SWEEP_INTERVAL_MS) {
            for (const [k, v] of buckets.entries()) {
                if (!v || now >= v.resetAt) buckets.delete(k);
            }
            lastSweepAt = now;
        }
        const key =
            req.clientIp ||
            req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
            req.ip ||
            "unknown";

        let bucket = buckets.get(key);
        if (!bucket || now >= bucket.resetAt) {
            bucket = { count: 0, resetAt: now + windowMs };
            buckets.set(key, bucket);
        }

        bucket.count += 1;
        if (bucket.count <= maxRequests) {
            return next();
        }

        const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
            success: false,
            message: "Too many requests, please try again shortly.",
        });
    };
}

/**
 * Basic security headers without external dependencies.
 * Keeps payload/response shape unchanged.
 */
export function securityHeaders(req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    res.setHeader("X-XSS-Protection", "0");
    next();
}

export function getHardeningConfigFromEnv() {
    const authLimiterEnabled = process.env.AUTH_RATE_LIMIT_ENABLED !== "0";
    return {
        authLimiterEnabled,
        authRateWindowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
        authRateMax: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, DEFAULT_MAX_REQUESTS),
    };
}
