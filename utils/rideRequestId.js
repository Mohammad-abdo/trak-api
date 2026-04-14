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
    const n = parseInt(String(raw).trim(), 10);
    if (isNaN(n) || n <= 0) return null;
    return n;
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
    if (intMatch) return parseInt(intMatch[1], 10);
    const n = parseInt(s, 10);
    if (!isNaN(n) && n > 0) return n;
    return null;
}
