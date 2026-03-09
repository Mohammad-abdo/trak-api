import prisma from "./prisma.js";

const DEFAULTS = {
    enabled: false,
    maxPercent: 20,
    maxRounds: 3,
    timeoutSeconds: 90,
};

/**
 * Read negotiation feature settings from the `settings` table.
 * Returns safe defaults when keys are missing.
 */
export async function getNegotiationSettings() {
    const rows = await prisma.setting.findMany({
        where: {
            key: {
                in: [
                    "ride_negotiation_enabled",
                    "ride_negotiation_max_percent",
                    "ride_negotiation_max_rounds",
                    "ride_negotiation_timeout_seconds",
                ],
            },
        },
    });

    const map = {};
    rows.forEach((r) => (map[r.key] = r.value));

    return {
        enabled: String(map.ride_negotiation_enabled ?? "false") === "true",
        maxPercent: Math.min(100, Math.max(0, parseFloat(map.ride_negotiation_max_percent) || DEFAULTS.maxPercent)),
        maxRounds: Math.max(1, parseInt(map.ride_negotiation_max_rounds, 10) || DEFAULTS.maxRounds),
        timeoutSeconds: Math.max(10, parseInt(map.ride_negotiation_timeout_seconds, 10) || DEFAULTS.timeoutSeconds),
    };
}

/**
 * Validate that a proposed fare is within the allowed negotiation range.
 * @param {number} baseFare      - original calculated fare
 * @param {number} proposedFare  - the fare being proposed
 * @param {number} maxPercent    - max allowed % change (e.g. 20)
 * @returns {{ valid: boolean, percentChange: number, message?: string }}
 */
export function validateFareBounds(baseFare, proposedFare, maxPercent) {
    if (baseFare <= 0) return { valid: false, percentChange: 0, message: "Base fare must be > 0" };
    if (proposedFare <= 0) return { valid: false, percentChange: 0, message: "Proposed fare must be > 0" };

    const percentChange = ((proposedFare - baseFare) / baseFare) * 100;
    const absChange = Math.abs(percentChange);

    if (absChange > maxPercent + 0.01) {
        return {
            valid: false,
            percentChange: Math.round(percentChange * 100) / 100,
            message: `Negotiation exceeds allowed range (±${maxPercent}%). Proposed change: ${percentChange.toFixed(1)}%`,
        };
    }

    return { valid: true, percentChange: Math.round(percentChange * 100) / 100 };
}

/**
 * Compute the expiration timestamp for a new negotiation round.
 */
export function computeExpiresAt(timeoutSeconds) {
    return new Date(Date.now() + timeoutSeconds * 1000);
}
