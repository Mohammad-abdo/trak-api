import prisma from "./prisma.js";

/**
 * نسبة الربح التي يأخذها النظام من قيمة الطلب (0-100).
 * ما يصل للسائق = قيمة الطلب × (1 - system_commission_percentage / 100)
 */
export async function getSystemCommissionPercentage() {
    const row = await prisma.setting.findUnique({
        where: { key: "system_commission_percentage" },
    });
    const pct = row?.value != null ? parseFloat(row.value) : 0;
    return Number.isNaN(pct) || pct < 0 ? 0 : Math.min(100, pct);
}

/**
 * @param {number} rideTotal - إجمالي قيمة الرحلة
 * @returns {{ driverShare: number, systemShare: number }}
 */
export async function getDriverAndSystemShare(rideTotal) {
    const pct = await getSystemCommissionPercentage();
    const systemShare = (rideTotal * pct) / 100;
    const driverShare = rideTotal - systemShare;
    return { driverShare, systemShare };
}
