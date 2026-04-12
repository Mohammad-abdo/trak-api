/**
 * Wallet debit helpers shared by ride payment flows.
 * @param {import('@prisma/client').Prisma.TransactionClient | import('@prisma/client').PrismaClient} tx
 */

/**
 * Debit rider wallet when balance is sufficient (no-op if insufficient — matches savePayment).
 * @returns {Promise<{ debited: boolean }>}
 */
export async function debitWalletForRideIfSufficient(tx, params) {
    const {
        userId,
        amount,
        rideRequestId,
        description,
        transactionType = "ride_payment",
    } = params;

    const amt = typeof amount === "number" ? amount : parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
        return { debited: false };
    }

    const wallet = await tx.wallet.findUnique({
        where: { userId },
    });

    if (!wallet || wallet.balance < amt) {
        return { debited: false };
    }

    const newBalance = wallet.balance - amt;

    await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
    });

    await tx.walletHistory.create({
        data: {
            walletId: wallet.id,
            userId,
            type: "debit",
            amount: amt,
            balance: newBalance,
            description,
            transactionType,
            rideRequestId,
        },
    });

    return { debited: true };
}

/**
 * Debit rider wallet or throw (scheduled prepaid rides).
 */
export async function debitWalletForRideOrThrow(tx, params) {
    const {
        userId,
        amount,
        rideRequestId,
        description,
        transactionType = "ride_payment",
    } = params;

    const amt = typeof amount === "number" ? amount : parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
        throw new Error("Invalid debit amount");
    }

    const wallet = await tx.wallet.findUnique({
        where: { userId },
    });

    if (!wallet || wallet.balance < amt) {
        throw new Error("Insufficient wallet balance");
    }

    const newBalance = wallet.balance - amt;

    await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
    });

    await tx.walletHistory.create({
        data: {
            walletId: wallet.id,
            userId,
            type: "debit",
            amount: amt,
            balance: newBalance,
            description,
            transactionType,
            rideRequestId,
        },
    });

    return { debited: true, newBalance };
}
