import prisma from "./prisma.js";

/**
 * System commission is applied ONCE on TOTAL wallet earnings (إجمالي أموال المحفظة).
 * Formula: systemCommissionAmount = totalDriverEarnings × (percentage / 100).
 * Wallet balance = totalDriverEarnings - systemCommissionAmount - totalWithdrawals (+ other adjustments).
 * Do NOT deduct commission per order; do NOT apply percentage on wallet balance again.
 */

/**
 * نسبة خصم السستم من إجمالي أرباح المحفظة (0-100).
 * الخصم يُطبَّق على إجمالي أموال المحفظة (من الإعدادات)، وليس لكل طلب.
 * إذا لم تكن النسبة موجودة في DB يتم إنشاؤها بقيمة 15.
 */
export async function getSystemCommissionPercentage() {
    let row = await prisma.setting.findUnique({
        where: { key: "system_commission_percentage" },
    });
    if (!row || row.value == null || String(row.value).trim() === "") {
        await prisma.setting.upsert({
            where: { key: "system_commission_percentage" },
            create: { key: "system_commission_percentage", value: "15" },
            update: { value: "15" },
        });
        return 15;
    }
    const pct = parseFloat(row.value);
    if (Number.isNaN(pct) || pct < 0) return 15;
    return Math.min(100, pct);
}

/**
 * Commission amount in EGP when applied on a total (e.g. total wallet earnings).
 * Used for display: totalSystemCommissionDeducted = totalEarnings × (pct/100).
 * @param {number} totalAmount - إجمالي المبلغ (مثلاً إجمالي أرباح الرحلات)
 * @param {number} [pct] - نسبة السستم 0–100 (يُقرأ من DB إن لم يُمرَّر)
 * @returns {Promise<number>} مبلغ العمولة بالجنيه
 */
export async function getCommissionAmountInEGP(totalAmount, pct) {
    const total = parseFloat(totalAmount);
    if (Number.isNaN(total) || total <= 0) return 0;
    const percentage = pct != null ? Math.min(100, Math.max(0, parseFloat(pct))) : await getSystemCommissionPercentage();
    return Math.round((total * percentage) / 100 * 100) / 100;
}

/**
 * Net amount to add to wallet for one ride: totalAmount × (1 - pct/100).
 * Commission is applied on total wallet earnings, not per order; this is only the net credit for this ride.
 * @param {number} rideTotal - إجمالي قيمة الرحلة (الطلب الواحد)
 * @param {number} pct - نسبة السستم 0–100
 * @returns {{ driverShare: number, systemShare: number }} driverShare = صافي يُضاف للمحفظة، systemShare = حصة السستم (للعرض فقط)
 */
export function getDriverAndSystemShareWithPct(rideTotal, pct) {
    const total = parseFloat(rideTotal);
    if (Number.isNaN(total) || total <= 0) return { driverShare: 0, systemShare: 0 };
    const p = Math.min(100, Math.max(0, parseFloat(pct) || 0));
    const systemShare = Math.round((total * p) / 100 * 100) / 100;
    const driverShare = Math.round((total - systemShare) * 100) / 100;
    return { driverShare, systemShare };
}

/**
 * @param {number} rideTotal - إجمالي قيمة الرحلة
 * @returns {{ driverShare: number, systemShare: number }}
 */
export async function getDriverAndSystemShare(rideTotal) {
    const total = parseFloat(rideTotal);
    if (Number.isNaN(total) || total <= 0) {
        return { driverShare: 0, systemShare: 0 };
    }
    let pct = await getSystemCommissionPercentage();
    if (pct <= 0) pct = 15;
    return getDriverAndSystemShareWithPct(total, pct);
}

/**
 * Get driver search radius from settings (in kilometers).
 * Default is 5 km if not set.
 */
export async function getDriverSearchRadius() {
    let row = await prisma.setting.findUnique({
        where: { key: "driver_search_radius" },
    });
    if (!row || row.value == null || String(row.value).trim() === "") {
        await prisma.setting.upsert({
            where: { key: "driver_search_radius" },
            update: { value: "5" },
            create: { key: "driver_search_radius", value: "5" },
        });
        return 5;
    }
    const radius = parseFloat(row.value);
    return Number.isNaN(radius) || radius <= 0 ? 5 : Math.min(50, radius); // Max 50km, min 1km
}

/**
 * Get driver rejection cooldown duration from settings (in hours).
 * Default is 24 hours if not set.
 * This is the time a driver is blocked after hitting the max rejection count.
 */
export async function getDriverRejectionCooldownDuration() {
    let row = await prisma.setting.findUnique({
        where: { key: "driver_rejection_cooldown_duration" },
    });
    if (!row || row.value == null || String(row.value).trim() === "") {
        await prisma.setting.upsert({
            where: { key: "driver_rejection_cooldown_duration" },
            update: { value: "24" },
            create: { key: "driver_rejection_cooldown_duration", value: "24" },
        });
        return 24;
    }
    const duration = parseFloat(row.value);
    return Number.isNaN(duration) || duration <= 0 ? 24 : Math.min(720, duration);
}

/**
 * Whether the driver rejection block feature is enabled.
 * When disabled drivers can reject any number of rides without being blocked.
 * Stored as "1" (enabled) or "0" (disabled). Default: enabled.
 */
export async function getDriverRejectionBlockEnabled() {
    let row = await prisma.setting.findUnique({
        where: { key: "driver_rejection_block_enabled" },
    });
    if (!row || row.value == null || String(row.value).trim() === "") {
        await prisma.setting.upsert({
            where: { key: "driver_rejection_block_enabled" },
            update: { value: "1" },
            create: { key: "driver_rejection_block_enabled", value: "1" },
        });
        return true;
    }
    return String(row.value).trim() === "1";
}

/**
 * Maximum number of ride rejections a driver is allowed before being blocked.
 * After this many rejections the driver cannot see new rides for `cooldownDuration` hours.
 * Default: 3 rejections.
 */
export async function getDriverRejectionMaxCount() {
    let row = await prisma.setting.findUnique({
        where: { key: "driver_rejection_max_count" },
    });
    if (!row || row.value == null || String(row.value).trim() === "") {
        await prisma.setting.upsert({
            where: { key: "driver_rejection_max_count" },
            update: { value: "3" },
            create: { key: "driver_rejection_max_count", value: "3" },
        });
        return 3;
    }
    const count = parseInt(row.value, 10);
    return Number.isNaN(count) || count < 1 ? 3 : Math.min(50, count);
}

/**
 * Convenience: fetch all three driver-rejection settings in one call.
 * Returns { enabled, maxCount, cooldownHours }
 */
export async function getDriverRejectionSettings() {
    const [enabled, maxCount, cooldownHours] = await Promise.all([
        getDriverRejectionBlockEnabled(),
        getDriverRejectionMaxCount(),
        getDriverRejectionCooldownDuration(),
    ]);
    return { enabled, maxCount, cooldownHours };
}
