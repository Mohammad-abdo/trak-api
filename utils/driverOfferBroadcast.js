/**
 * Driver offer reject / cancel — dual emit kebab-case + camelCase (Flutter).
 */

import { emitToDriver, emitToRide, emitToUser } from "./socketService.js";

function dualEmitToParty(io, emitFn, id, eventKebab, eventCamel, payload) {
    if (!io || id == null) return;
    emitFn(io, id, eventKebab, payload);
    emitFn(io, id, eventCamel, payload);
}

/**
 * Rider rejected a driver offer (bid, negotiation, or unassign).
 */
export function emitDriverOfferRejected(io, { rideRequestId, riderId, driverId, rideStatus, previousStatus }) {
    if (!io) return;
    const id = typeof rideRequestId === "number" ? rideRequestId : parseInt(String(rideRequestId), 10);
    if (Number.isNaN(id)) return;

    const body = {
        rideRequestId: id,
        booking_id: id,
        driverId,
        riderId,
        rejectedBy: "rider",
        reason: "rider_rejected_offer",
        rideStatus: rideStatus ?? "pending",
        previousStatus: previousStatus ?? null,
        rejectedAt: new Date().toISOString(),
    };

    dualEmitToParty(io, emitToUser, riderId, "driver-offer-rejected", "driverOfferRejected", body);
    dualEmitToParty(io, emitToDriver, driverId, "driver-offer-rejected", "driverOfferRejected", body);
    emitToRide(io, id, "driver-offer-rejected", body);
    emitToRide(io, id, "driverOfferRejected", body);
}

/**
 * Legacy + rider: driver removed after accept (unassign).
 */
export function emitDriverOfferCancelled(io, { rideRequestId, riderId, driverId }) {
    if (!io) return;
    const id = typeof rideRequestId === "number" ? rideRequestId : parseInt(String(rideRequestId), 10);
    if (Number.isNaN(id)) return;

    const body = {
        booking_id: id,
        rideRequestId: id,
        rider_id: riderId,
        driverId,
        riderId,
        cancelledBy: "rider",
    };

    dualEmitToParty(io, emitToDriver, driverId, "driver-offer-cancelled", "driverOfferCancelled", body);
    dualEmitToParty(io, emitToUser, riderId, "driver-offer-cancelled", "driverOfferCancelled", body);
    emitToRide(io, id, "driver-offer-cancelled", body);
}

export function emitRideNegotiationRejectedByRider(io, { rideRequestId, riderId, driverId, baseFare }) {
    if (!io) return;
    const id = typeof rideRequestId === "number" ? rideRequestId : parseInt(String(rideRequestId), 10);
    if (Number.isNaN(id)) return;

    const body = {
        rideRequestId: id,
        driverId,
        riderId,
        negotiationStatus: "rejected",
        negotiatedFare: null,
        baseFare: baseFare != null ? parseFloat(baseFare) : null,
        rejectedBy: "rider",
    };

    emitToUser(io, riderId, "ride-negotiation-rejected", body);
    emitToDriver(io, driverId, "ride-negotiation-rejected", body);
}
