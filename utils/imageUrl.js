/**
 * Build a full image URL from a relative path using the current request's host.
 * Returns null for falsy inputs or paths that are already absolute URLs.
 *
 * @param {import('express').Request} req - Express request object
 * @param {string|null|undefined} relativePath - e.g. "/uploads/vehicle-categories/vc_123.png"
 * @returns {string|null}
 */
export function fullImageUrl(req, relativePath) {
    if (!relativePath) return null;
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) return relativePath;

    const proto = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${proto}://${host}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}
