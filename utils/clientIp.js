/**
 * Client IP and request metadata for logging / audit (behind reverse proxies when trust proxy is set).
 */

export function getForwardedForHeader(req) {
    const raw = req.headers["x-forwarded-for"];
    if (typeof raw !== "string" || !raw.trim()) return null;
    return raw.trim();
}

/**
 * First public-ish client IP from X-Forwarded-For chain, or null.
 */
export function getClientIpFromForwardedFor(req) {
    const header = getForwardedForHeader(req);
    if (!header) return null;
    const first = header.split(",")[0]?.trim();
    return first || null;
}

/**
 * @returns {{ ip: string | null, forwardedFor: string | null, userAgent: string | null }}
 */
export function getRequestNetworkMeta(req) {
    const forwardedFor = getForwardedForHeader(req);
    const fromExpress = typeof req.ip === "string" && req.ip ? req.ip.trim() : null;
    const fromHeader = getClientIpFromForwardedFor(req);
    const ip = fromHeader || fromExpress || null;
    const userAgent =
        typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 512) : null;
    return { ip, forwardedFor, userAgent };
}
