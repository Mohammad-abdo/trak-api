import prisma from "./prisma.js";

/**
 * نسبة الربح التي يأخذها النظام من قيمة الطلب (0-100).
 * ما يصل للسائق = قيمة الطلب × (1 - system_commission_percentage / 100)
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
 * حساب حصة السائق وحصة السستم من إجمالي الرحلة (بدون قراءة من DB).
 * المعادلة: حصة السستم = إجمالي الرحلة × (النسبة ÷ 100) مقرباً لمنزلتين عشريتين.
 * حصة السائق = إجمالي الرحلة − حصة السستم (مقرب لمنزلتين).
 * @param {number} rideTotal - إجمالي قيمة الرحلة
 * @param {number} pct - نسبة السستم 0–100
 * @returns {{ driverShare: number, systemShare: number }}
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
