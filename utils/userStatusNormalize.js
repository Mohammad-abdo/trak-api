/**
 * Normalize status from admin/API clients (handles "Active", "  active ", etc.).
 * @param {unknown} status
 * @returns {string | undefined}
 */
export function normalizeUserStatusInput(status) {
    if (status === undefined || status === null || status === "") return undefined;
    if (typeof status === "string") return status.trim().toLowerCase();
    return status;
}
