import prisma from "./prisma.js";

/**
 * Commission is ONLY applied to each ORDER amount (orderTotal).
 * NEVER apply commission percentage to wallet balance.
 * Formula: commissionInEGP = orderAmount × (percentage / 100) — fixed EGP per order.
 */

/**
 * نسبة الربح التي يأخذها النظام من قيمة الطلب (0-100).
 * تُطبَّق النسبة على قيمة الطلب فقط، وليس على رصيد المحفظة.
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
 * Commission amount in EGP for a single order. Used for deduction only.
 * NEVER use this on wallet balance — only on order total.
 * @param {number} orderAmount - إجمالي قيمة الطلب
 * @param {number} [pct] - نسبة السستم 0–100 (يُقرأ من DB إن لم يُمرَّر)
 * @returns {Promise<number>} مبلغ العمولة بالجنيه (قيمة ثابتة للطلب الواحد)
 */
export async function getCommissionAmountInEGP(orderAmount, pct) {
    const total = parseFloat(orderAmount);
    if (Number.isNaN(total) || total <= 0) return 0;
    const percentage = pct != null ? Math.min(100, Math.max(0, parseFloat(pct))) : await getSystemCommissionPercentage();
    const commissionEGP = Math.round((total * percentage) / 100 * 100) / 100;
    return commissionEGP;
}

/**
 * حساب حصة السائق وحصة السستم من إجمالي الرحلة فقط (بدون قراءة من DB).
 * المعادلة: حصة السستم (بالجنيه) = إجمالي الرحلة × (النسبة ÷ 100) — تُخصم مرة واحدة لكل طلب.
 * حصة السائق = إجمالي الرحلة − حصة السستم. لا تُطبَّق أي نسبة على رصيد المحفظة.
 * @param {number} rideTotal - إجمالي قيمة الرحلة (الطلب الواحد)
 * @param {number} pct - نسبة السستم 0–100
 * @returns {{ driverShare: number, systemShare: number }} قيم بالجنيه للطلب الواحد فقط
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
