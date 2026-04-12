import prisma from "../utils/prisma.js";
import { userHasAnyPermission } from "../utils/staffPermissions.js";
import {
    completePaidGatewayPayment,
    getEffectiveRidePaymentTotal,
} from "../services/ridePaymentCompletionService.js";
import { notifyPayskyWebhookAdmin } from "../utils/payskyWebhookAdminNotify.js";

/** Exported for webhook-info / UI. */
export function payskyTripSimulationAllowed() {
    return process.env.NODE_ENV !== "production" || String(process.env.PAYSKY_SIMULATE_TRIP_PAYMENT || "").trim() === "1";
}

/**
 * Dev / QA: record a successful card+PaySky payment for a trip (same outcome as a real PaySky notification).
 * Not a substitute for PaySky HMAC testing — use the hash tool + POST for that.
 *
 * Allowed: ride rider, admin, or staff with wallets/rides permissions.
 * @route POST /api/payments/paysky/simulate-trip-payment
 * @route POST /apimobile/user/payments/paysky-simulate
 */
export const payskySimulateTripPayment = async (req, res) => {
    if (!payskyTripSimulationAllowed()) {
        return res.status(403).json({
            success: false,
            message:
                "Trip payment simulation is off in production. Set PAYSKY_SIMULATE_TRIP_PAYMENT=1 in backend .env, or run with NODE_ENV=development.",
        });
    }

    const rideRequestId = parseInt(req.body?.rideRequestId ?? req.body?.ride_request_id, 10);
    if (!Number.isFinite(rideRequestId) || rideRequestId < 1) {
        return res.status(400).json({ success: false, message: "rideRequestId is required (positive integer)" });
    }

    const ride = await prisma.rideRequest.findUnique({ where: { id: rideRequestId } });
    if (!ride) {
        return res.status(404).json({ success: false, message: "Ride request not found" });
    }

    const uid = req.user.id;
    const userType = req.user.userType;
    const isAdmin = userType === "admin";
    const isRider = ride.riderId === uid;

    let staffOk = false;
    if (!isAdmin && !isRider) {
        staffOk = await userHasAnyPermission(uid, userType, [
            "wallets.manage",
            "wallets.view",
            "rides.manage",
            "rides.view",
        ]);
    }

    if (!isAdmin && !isRider && !staffOk) {
        return res.status(403).json({
            success: false,
            message: "You can only simulate payment for your own rides (rider) or as staff with ride/wallet access.",
        });
    }

    if (ride.driverId == null) {
        return res.status(400).json({
            success: false,
            message: "This ride has no driver yet. Assign a driver before simulating PaySky payment.",
        });
    }

    const paid = await prisma.payment.findFirst({
        where: { rideRequestId, paymentStatus: "paid" },
    });
    if (paid) {
        return res.status(200).json({
            success: true,
            message: "This ride already has a paid payment.",
            data: { alreadyPaid: true, paymentId: paid.id, rideRequestId },
        });
    }

    const amount = getEffectiveRidePaymentTotal(ride);
    const transactionId = `SIM-PAYSKY-${rideRequestId}-${Date.now()}`;

    await completePaidGatewayPayment(prisma, ride, {
        paymentType: "card",
        transactionId,
        paymentGateway: "paysky",
        amount,
    });

    await notifyPayskyWebhookAdmin({
        success: true,
        titleEn: "PaySky: simulated trip payment (test)",
        titleAr: "PaySky: محاكاة دفع الرحلة (اختبار)",
        messageEn: `Ride #${rideRequestId} marked paid via simulation. Txn ${transactionId}.`,
        messageAr: `الرحلة #${rideRequestId} سُجّلت كمدفوعة عبر المحاكاة. ${transactionId}`,
        rideRequestId,
        systemReference: transactionId,
        txnType: "SIM",
        actionCode: "SIM",
    });

    return res.json({
        success: true,
        message: "Simulated PaySky payment recorded. Ride payment is now paid (same as webhook success).",
        data: { rideRequestId, transactionId, amount },
    });
};
