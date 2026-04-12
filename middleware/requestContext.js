import { randomUUID } from "crypto";
import { getRequestNetworkMeta } from "../utils/clientIp.js";

/**
 * Attaches req.requestId and logs a single line per request (optional, lightweight).
 */
export function requestContextMiddleware(req, res, next) {
    req.requestId = randomUUID();
    const { ip } = getRequestNetworkMeta(req);
    req.clientIp = ip;
    const start = Date.now();
    res.on("finish", () => {
        if (process.env.HTTP_ACCESS_LOG !== "1") return;
        const ms = Date.now() - start;
        console.log(
            JSON.stringify({
                level: "info",
                msg: "http_request",
                requestId: req.requestId,
                method: req.method,
                path: req.originalUrl?.split("?")[0] || req.path,
                status: res.statusCode,
                ms,
                userId: req.user?.id ?? null,
                ip: ip || undefined,
            })
        );
    });
    next();
}
