import prisma from "../../utils/prisma.js";
import { getDriverAndSystemShare } from "../../utils/settingsHelper.js";

// @desc    Backfill driver wallet history from existing paid payments (مرة واحدة لتعويض أرباح سابقة)
// @route   POST /api/wallets/backfill-driver-earnings
// @access  Private (Admin)
export const backfillDriverEarnings = async (req, res) => {
    try {
        const paidPayments = await prisma.payment.findMany({
            where: { paymentStatus: "paid" },
            include: { rideRequest: { select: { id: true, totalAmount: true } } },
        });
        let created = 0;
        for (const p of paidPayments) {
            const driverId = p.driverId;
            const rideTotal = p.amount || p.rideRequest?.totalAmount;
            if (!driverId || !rideTotal || rideTotal <= 0) continue;
            const existing = await prisma.walletHistory.findFirst({
                where: {
                    rideRequestId: p.rideRequestId,
                    userId: driverId,
                    type: "credit",
                    transactionType: "ride_earnings",
                },
            });
            if (existing) continue;
            const { driverShare } = await getDriverAndSystemShare(rideTotal);
            let driverWallet = await prisma.wallet.findUnique({
                where: { userId: driverId },
            });
            if (!driverWallet) {
                driverWallet = await prisma.wallet.create({
                    data: { userId: driverId, balance: 0 },
                });
            }
            const currentBalance = parseFloat(driverWallet.balance) || 0;
            const newBalance = Math.round((currentBalance + driverShare) * 100) / 100;
            await prisma.wallet.update({
                where: { id: driverWallet.id },
                data: { balance: newBalance },
            });
            await prisma.walletHistory.create({
                data: {
                    walletId: driverWallet.id,
                    userId: driverId,
                    type: "credit",
                    amount: rideTotal,
                    balance: newBalance,
                    description: "Ride earnings (backfill); commission on total wallet",
                    transactionType: "ride_earnings",
                    rideRequestId: p.rideRequestId,
                },
            });
            created++;
        }
        res.json({
            success: true,
            message: `Backfill complete. Created ${created} driver earnings entries.`,
            data: { created, totalPaidPayments: paidPayments.length },
        });
    } catch (error) {
        console.error("Backfill driver earnings error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Ensure ride_earnings store gross and recalc wallet balances (commission on total)
// @route   POST /api/wallets/fix-commission-on-earnings
// @access  Private (Admin)
export const fixCommissionOnRideEarnings = async (req, res) => {
    try {
        const commissionRow = await prisma.setting.findUnique({ where: { key: "system_commission_percentage" } });
        const pct = Math.min(100, Math.max(0, parseFloat(commissionRow?.value) || 15));
        const histories = await prisma.walletHistory.findMany({
            where: { type: "credit", transactionType: "ride_earnings" },
            include: { rideRequest: { select: { id: true, totalAmount: true } } },
        });
        let updatedAmounts = 0;
        for (const h of histories) {
            const gross = parseFloat(h.rideRequest?.totalAmount ?? 0) || 0;
            if (gross <= 0) continue;
            const currentAmount = parseFloat(h.amount ?? 0) || 0;
            if (Math.abs(currentAmount - gross) < 0.01) continue;
            await prisma.walletHistory.update({
                where: { id: h.id },
                data: { amount: gross },
            });
            updatedAmounts++;
        }
        const walletIds = [...new Set((await prisma.walletHistory.findMany({ where: { transactionType: "ride_earnings" }, select: { walletId: true } })).map((x) => x.walletId))];
        for (const walletId of walletIds) {
            const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
            if (!wallet) continue;
            const [rideSum, withdrawalSum, otherCreditsSum, otherDebitsSum] = await Promise.all([
                prisma.walletHistory.aggregate({
                    where: { walletId, type: "credit", transactionType: "ride_earnings" },
                    _sum: { amount: true },
                }),
                prisma.walletHistory.aggregate({
                    where: { walletId, type: "debit", transactionType: "withdrawal" },
                    _sum: { amount: true },
                }),
                prisma.walletHistory.aggregate({
                    where: { walletId, type: "credit", transactionType: { notIn: ["ride_earnings"] } },
                    _sum: { amount: true },
                }),
                prisma.walletHistory.aggregate({
                    where: { walletId, type: "debit", transactionType: { notIn: ["withdrawal"] } },
                    _sum: { amount: true },
                }),
            ]);
            const totalEarnings = Math.round(Number(rideSum._sum?.amount ?? 0) * 100) / 100;
            const withdrawals = Math.round(Number(withdrawalSum._sum?.amount ?? 0) * 100) / 100;
            const otherCredits = Math.round(Number(otherCreditsSum._sum?.amount ?? 0) * 100) / 100;
            const otherDebits = Math.round(Number(otherDebitsSum._sum?.amount ?? 0) * 100) / 100;
            const newBalance = Math.round((totalEarnings * (1 - pct / 100) - withdrawals + otherCredits - otherDebits) * 100) / 100;
            await prisma.wallet.update({
                where: { id: walletId },
                data: { balance: newBalance },
            });
        }
        res.json({
            success: true,
            message: updatedAmounts > 0 || walletIds.length > 0
                ? `Updated ${updatedAmounts} ride_earnings to gross; recalculated ${walletIds.length} wallet balances (commission on total).`
                : "No changes needed.",
            data: { updatedAmounts, totalChecked: histories.length, walletsRecalculated: walletIds.length },
        });
    } catch (error) {
        console.error("Fix commission on earnings error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * إعادة حساب أرصدة كل المحافظ عند تغيير نسبة السستم في الإعدادات.
 * الخصم يُطبَّق على إجمالي أرباح المحفظة: balance = totalEarnings × (1 − newPct%) − withdrawals + other.
 * @param {number} newPct - النسبة الجديدة 0–100
 * @returns {{ walletsRecalculated: number }}
 */
export async function recalculateWalletsForNewCommissionPercentage(newPct) {
    const pct = Math.min(100, Math.max(0, parseFloat(newPct) || 0));
    const wallets = await prisma.wallet.findMany({ select: { id: true } });
    let count = 0;
    for (const w of wallets) {
        const [rideSum, withdrawalSum, otherCreditsSum, otherDebitsSum] = await Promise.all([
            prisma.walletHistory.aggregate({
                where: { walletId: w.id, type: "credit", transactionType: "ride_earnings" },
                _sum: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: { walletId: w.id, type: "debit", transactionType: "withdrawal" },
                _sum: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: { walletId: w.id, type: "credit", transactionType: { notIn: ["ride_earnings"] } },
                _sum: { amount: true },
            }),
            prisma.walletHistory.aggregate({
                where: { walletId: w.id, type: "debit", transactionType: { notIn: ["withdrawal"] } },
                _sum: { amount: true },
            }),
        ]);
        const totalEarnings = Math.round(Number(rideSum._sum?.amount ?? 0) * 100) / 100;
        const withdrawals = Math.round(Number(withdrawalSum._sum?.amount ?? 0) * 100) / 100;
        const otherCredits = Math.round(Number(otherCreditsSum._sum?.amount ?? 0) * 100) / 100;
        const otherDebits = Math.round(Number(otherDebitsSum._sum?.amount ?? 0) * 100) / 100;
        const newBalance = Math.round((totalEarnings * (1 - pct / 100) - withdrawals + otherCredits - otherDebits) * 100) / 100;
        await prisma.wallet.update({
            where: { id: w.id },
            data: { balance: newBalance },
        });
        count++;
    }
    return { walletsRecalculated: count };
}
