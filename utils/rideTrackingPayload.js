import { parseRideRequestIdParam } from "./rideRequestId.js";

/** Parse ride/trip id from socket or REST body. */
export function parseTripIdFromPayload(payload) {
    if (payload == null) return null;
    if (typeof payload === "number" && Number.isFinite(payload)) {
        return parseRideRequestIdParam(String(payload));
    }
    if (typeof payload === "string") return parseRideRequestIdParam(payload);
    if (typeof payload === "object") {
        const raw =
            payload.tripId ??
            payload.trip_id ??
            payload.rideRequestId ??
            payload.ride_request_id ??
            payload.booking_id ??
            payload.bookingId;
        if (raw != null) return parseRideRequestIdParam(raw);
    }
    return null;
}

/** Normalize lat/lng from Flutter or REST shapes. */
export function parseLocationFromPayload(payload) {
    if (!payload || typeof payload !== "object") return null;
    const lat = payload.lat ?? payload.latitude;
    const lng = payload.lng ?? payload.longitude;
    if (lat == null || lng == null) return null;
    const latitude = String(lat).trim();
    const longitude = String(lng).trim();
    if (!latitude || !longitude) return null;
    const headingRaw = payload.currentHeading ?? payload.heading;
    const currentHeading =
        headingRaw != null && headingRaw !== "" && !Number.isNaN(parseFloat(headingRaw))
            ? parseFloat(headingRaw)
            : undefined;
    return { latitude, longitude, currentHeading };
}

/** Build dual-shape location payload for ride room emits. */
export function buildDriverLocationRidePayload(rideRequestId, driverId, latitude, longitude, currentHeading) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    return {
        rideRequestId,
        tripId: rideRequestId,
        driverId,
        latitude: String(latitude),
        longitude: String(longitude),
        lat: Number.isFinite(lat) ? lat : latitude,
        lng: Number.isFinite(lng) ? lng : longitude,
        heading: currentHeading != null ? currentHeading : null,
    };
}
