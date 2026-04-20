/**
 * RideRequest primary keys are now integers (autoincrement).
 * Use this module anywhere an id is parsed from HTTP params/body/query.
 */

/**
 * @param {unknown} raw
 * @returns {number | null} integer id or null
 */
export function parseRideRequestIdParam(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    // Whole string must be digits — parseInt("123e4567-uuid", 10) === 123 (wrong ride).
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n <= 0) return null;
    return n;
}

/**
 * Common JSON body keys from driver/rider mobile apps.
 * @param {object | null | undefined} body
 * @returns {unknown}
 */
export function pickRideRequestIdFromBody(body) {
    if (!body || typeof body !== "object") return null;
    return (
        body.rideRequestId ??
        body.ride_request_id ??
        body.booking_id ??
        body.bookingId
    );
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidRideRequestId(raw) {
    return parseRideRequestIdParam(raw) != null;
}

/**
 * PaySky MerchantReference: plain integer, or RIDE:<id> / RIDE_<id>.
 * @param {unknown} ref
 * @returns {number | null}
 */
export function parseRideRequestIdFromMerchantReference(ref) {
    if (ref == null) return null;
    const s = String(ref).trim();
    if (!s) return null;
    const intMatch = s.match(/^RIDE[:_\s-]+(\d+)$/i);
    if (intMatch) {
        const n = Number(intMatch[1]);
        return Number.isSafeInteger(n) && n > 0 ? n : null;
    }
    return parseRideRequestIdParam(s);
}
