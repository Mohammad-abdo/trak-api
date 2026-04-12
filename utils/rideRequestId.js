/**
 * RideRequest primary keys are UUID strings (v4-style).
 * Use this module anywhere an id is parsed from HTTP params/body/query.
 */

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} raw
 * @returns {string | null} trimmed UUID or null
 */
export function parseRideRequestIdParam(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s || !UUID_RE.test(s)) return null;
    return s;
}

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidRideRequestId(raw) {
    return parseRideRequestIdParam(raw) != null;
}

/**
 * PaySky MerchantReference: plain UUID, or RIDE:<uuid> / RIDE_<uuid>.
 * @param {unknown} ref
 * @returns {string | null}
 */
export function parseRideRequestIdFromMerchantReference(ref) {
    if (ref == null) return null;
    const s = String(ref).trim();
    if (!s) return null;
    if (UUID_RE.test(s)) return s;
    const prefixed = s.match(/RIDE[:_\s-]+([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
    if (prefixed) return prefixed[1];
    return null;
}
