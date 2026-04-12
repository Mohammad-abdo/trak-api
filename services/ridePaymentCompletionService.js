import { getDriverAndSystemShare } from "../utils/settingsHelper.js";

export function getEffectiveRidePaymentTotal(rideRequest) {
    const effectiveFare =
        rideRequest.negotiationStatus === "accepted" && rideRequest.negotiatedFare != null
            ? parseFloat(rideRequest.negotiatedFare)
            : parseFloat(rideRequest.totalAmount) || 0;
    return effectiveFare + (parseFloat(rideRequest.tips) || 0);
}

/**
 * Upsert payment as paid and credit driver wallet for ride earnings (card/gateway/cash-like paths).
 * Does not debit rider wallet — use only after wallet debit elsewhere for `wallet` type.
 *
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {import("@prisma/client").RideRequest} rideRequest
 * @param {{ paymentType: string; transactionId?: string | null; paymentGateway?: string | null; amount?: number }} opts
 */
export async function completePaidGatewayPayment(prisma, rideRequest, opts) {
    const { paymentType, transactionId, paymentGateway, amount: amountOverride } = opts;
    const rideRequestId = rideRequest.id;
    const payAmount = amountOverride != null ? amountOverride : getEffectiveRidePaymentTotal(rideRequest);

    let payment = await prisma.payment.findFirst({
        where: { rideRequestId },
    });

    if (payment) {
        payment = await prisma.payment.update({
            where: { id: payment.id },
            data: {
                amount: payAmount,
                paymentType,
                paymentStatus: "paid",
                transactionId: transactionId ?? undefined,
                paymentGateway: paymentGateway ?? undefined,
            },
        });
    } else {
        payment = await prisma.payment.create({
            data: {
                rideRequestId: rideRequest.id,
                userId: rideRequest.riderId,
                driverId: rideRequest.driverId,
                amount: payAmount,
                paymentType,
                paymentStatus: "paid",
                transactionId: transactionId ?? undefined,
                paymentGateway: paymentGateway ?? undefined,
            },
        });
    }

    const rideTotal = Number(payAmount) || 0;
    const driverId = rideRequest.driverId;
    if (driverId && rideTotal > 0) {
        const alreadyCredited = await prisma.walletHistory.findFirst({
            where: {
                rideRequestId: rideRequest.id,
                userId: driverId,
                type: "credit",
                transactionType: "ride_earnings",
            },
        });
        if (!alreadyCredited) {
            const { driverShare } = await getDriverAndSystemShare(rideTotal);
            const amountToCredit = driverShare > 0 ? driverShare : 0;
            if (amountToCredit > 0) {
                let driverWallet = await prisma.wallet.findUnique({
                    where: { userId: driverId },
                });
                if (!driverWallet) {
                    driverWallet = await prisma.wallet.create({
                        data: { userId: driverId, balance: 0 },
                    });
                }
                const currentBalance = parseFloat(driverWallet.balance) || 0;
                const newDriverBalance = Math.round((currentBalance + amountToCredit) * 100) / 100;
                await prisma.wallet.update({
                    where: { id: driverWallet.id },
                    data: { balance: newDriverBalance },
                });
                await prisma.walletHistory.create({
                    data: {
                        walletId: driverWallet.id,
                        userId: driverId,
                        type: "credit",
                        amount: rideTotal,
                        balance: newDriverBalance,
                        description: `Ride earnings | total: ${rideTotal} | net credited: ${amountToCredit}`,
                        transactionType: "ride_earnings",
                        rideRequestId: rideRequest.id,
                    },
                });
            }
        }
    }

    return payment;
}
