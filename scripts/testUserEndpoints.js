/**
 * End-to-end HTTP smoke test for the mobile USER API.
 *
 * Exercises every `/apimobile/user/*` route plus the new ride-chat routes.
 * The flow:
 *   1. Login as the seeded rider  -> grab JWT.
 *   2. Hit read-only endpoints    (home, services, booking lookups, profile,
 *                                  wallet, static pages, negotiation settings,
 *                                  notifications, addresses, cards).
 *   3. Create a CUSTOM TRIP via POST /booking/create.
 *   4. Have the driver accept it  (directly via Prisma — driver mobile
 *                                  controller is covered by its own tests).
 *   5. Exercise the chat endpoints for both rider and driver.
 *   6. Track the ride, cancel it, rate, review, etc.
 *   7. Print a pass/fail table at the end and exit non-zero if anything failed.
 *
 * Requires: `npm run test:seed-e2e` run first.
 *
 * Env:
 *   BASE_URL   (default http://localhost:5000)
 *   JWT_SECRET (same value the server uses; falls back to the project default)
 */

import prisma from "../utils/prisma.js";
import { generateToken } from "../utils/jwtHelper.js";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const RIDER_PHONE = "0100000E2E1";
const RIDER_PASSWORD = "E2ERider@123";
const DRIVER_PHONE = "0100000E2E2";

// ANSI colours (no dependency).
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[36m${s}\x1b[0m`;

const results = []; // { name, method, path, status, ok, note }

async function req(method, path, { token, body, query } = {}) {
    const url = new URL(path, BASE_URL);
    if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
        json = await res.json();
    } catch (_) {}
    return { status: res.status, body: json };
}

function record(name, method, path, res, { allow = [200, 201], note = "" } = {}) {
    const ok = allow.includes(res.status);
    results.push({
        name,
        method,
        path,
        status: res.status,
        ok,
        note: note || (ok ? "" : (res.body && (res.body.message || JSON.stringify(res.body).slice(0, 180))) || ""),
    });
    const badge = ok ? G("PASS") : R("FAIL");
    console.log(`  ${badge} ${method.padEnd(6)} ${path}  → ${res.status}${note ? "  (" + note + ")" : ""}`);
    return ok;
}

async function main() {
    console.log(B(`\n▶ Testing ${BASE_URL}\n`));

    // ── 0. Sanity: server + DB are up ────────────────────────────────────
    console.log(Y("[0] Health"));
    record("health", "GET", "/api/health", await req("GET", "/api/health"));
    record("socket-probe", "GET", "/api/health/socket", await req("GET", "/api/health/socket"));

    // Verify seeded users exist before anything else.
    const rider = await prisma.user.findFirst({ where: { contactNumber: RIDER_PHONE } });
    const driver = await prisma.user.findFirst({ where: { contactNumber: DRIVER_PHONE } });
    if (!rider || !driver) {
        console.error(R("\n✗ Seeded rider/driver not found. Run: npm run test:seed-e2e\n"));
        process.exit(1);
    }

    // Mint a driver token locally (the driver has its own login/register flow
    // — not part of the user test surface).
    const driverToken = generateToken(driver.id);

    // ── 1. Auth ──────────────────────────────────────────────────────────
    console.log(Y("\n[1] Auth"));
    const login = await req("POST", "/apimobile/user/auth/login", {
        body: { phone: RIDER_PHONE, password: RIDER_PASSWORD },
    });
    record("auth.login", "POST", "/apimobile/user/auth/login", login);
    const token = login.body && login.body.data && login.body.data.token;
    if (!token) {
        console.error(R("\n✗ Login failed, cannot continue.\n"));
        process.exit(1);
    }

    record(
        "auth.current-location",
        "POST",
        "/apimobile/user/auth/current-location",
        await req("POST", "/apimobile/user/auth/current-location", {
            token,
            body: { latitude: 30.0444, longitude: 31.2357 },
        })
    );

    // ── 2. Home / Services ───────────────────────────────────────────────
    console.log(Y("\n[2] Home / Services"));
    record("home.slider", "GET", "/apimobile/user/home/slider-offers",
        await req("GET", "/apimobile/user/home/slider-offers", { token }));
    record("home.services", "GET", "/apimobile/user/home/services",
        await req("GET", "/apimobile/user/home/services", { token }));
    record("home.last-booking", "GET", "/apimobile/user/home/last-booking",
        await req("GET", "/apimobile/user/home/last-booking", { token }));

    record("services.all", "GET", "/apimobile/user/services/all",
        await req("GET", "/apimobile/user/services/all", { token }));

    const vc = await prisma.vehicleCategory.findFirst({ where: { name: "E2E Sedan" } });
    const svc = await prisma.service.findFirst({ where: { name: "E2E Service" } });
    if (svc) {
        record("services.choose", "GET", `/apimobile/user/services/choose/${svc.id}`,
            await req("GET", `/apimobile/user/services/choose/${svc.id}`, { token }));
    }

    // ── 3. Booking lookups ───────────────────────────────────────────────
    console.log(Y("\n[3] Booking lookups"));
    if (svc) {
        record("booking.vehicle-types", "GET", `/apimobile/user/booking/vehicle-types/${svc.id}`,
            await req("GET", `/apimobile/user/booking/vehicle-types/${svc.id}`, { token }));
    }
    const shipSizesRes = await req("GET", "/apimobile/user/booking/shipment-sizes", {
        token, query: { vehicleCategoryId: vc?.id },
    });
    const sizesArray = Array.isArray(shipSizesRes.body?.data) ? shipSizesRes.body.data : [];
    const sizesOk = shipSizesRes.status === 200 && sizesArray.length > 0
        && sizesArray.every((r) => r.shipmentSize_id !== undefined);
    record("booking.shipment-sizes", "GET", "/apimobile/user/booking/shipment-sizes", shipSizesRes, {
        allow: [200],
        note: sizesOk
            ? `count=${sizesArray.length} has shipmentSize_id`
            : `count=${sizesArray.length} (check alias)`,
    });
    if (!sizesOk) {
        results.push({ name: "shipment-sizes payload check", method: "CHECK", path: "data[*].shipmentSize_id", status: 0, ok: false, note: "empty or missing alias" });
    }

    const shipWeightsRes = await req("GET", "/apimobile/user/booking/shipment-weights", {
        token, query: { vehicleCategoryId: vc?.id },
    });
    const weightsArray = Array.isArray(shipWeightsRes.body?.data) ? shipWeightsRes.body.data : [];
    const weightsOk = shipWeightsRes.status === 200 && weightsArray.length > 0
        && weightsArray.every((r) => r.shipmentWeight_id !== undefined);
    record("booking.shipment-weights", "GET", "/apimobile/user/booking/shipment-weights", shipWeightsRes, {
        allow: [200],
        note: weightsOk
            ? `count=${weightsArray.length} has shipmentWeight_id`
            : `count=${weightsArray.length} (check alias)`,
    });
    if (!weightsOk) {
        results.push({ name: "shipment-weights payload check", method: "CHECK", path: "data[*].shipmentWeight_id", status: 0, ok: false, note: "empty or missing alias" });
    }
    record("booking.payment-methods", "GET", "/apimobile/user/booking/payment-methods",
        await req("GET", "/apimobile/user/booking/payment-methods", { token }));

    // ── 4. Create a CUSTOM TRIP (the core flow) ─────────────────────────
    console.log(Y("\n[4] Custom trip (POST /booking/create)"));
    const size = await prisma.shipmentSize.findFirst({ where: { vehicleCategoryId: vc?.id } });
    const weight = await prisma.shipmentWeight.findFirst({ where: { vehicleCategoryId: vc?.id } });
    const tripBody = {
        vehicle_id: vc?.id,
        shipmentSize_id: size?.id ?? null,
        shipmentWeight_id: weight?.id ?? null,
        paymentMethod: "cash",
        from: { lat: 30.0444, lng: 31.2357, address: "Tahrir Sq, Cairo" },
        to:   { lat: 30.0595, lng: 31.2234, address: "Zamalek, Cairo" },
    };
    const createTrip = await req("POST", "/apimobile/user/booking/create", { token, body: tripBody });
    record("booking.create", "POST", "/apimobile/user/booking/create", createTrip, {
        allow: [201],
        note: createTrip.body && createTrip.body.data ? `rideId=${createTrip.body.data.booking_id}` : "",
    });
    const rideId = createTrip.body && createTrip.body.data && createTrip.body.data.booking_id;

    // ── 5. Offers ────────────────────────────────────────────────────────
    if (rideId) {
        console.log(Y("\n[5] Offers"));
        record("offers.near-drivers", "POST", "/apimobile/user/offers/near-drivers",
            await req("POST", "/apimobile/user/offers/near-drivers", {
                token, body: { bookingId: rideId, latitude: 30.0444, longitude: 31.2357, radius: 5 },
            }));

        record("offers.accept-driver", "POST", "/apimobile/user/offers/accept-driver",
            await req("POST", "/apimobile/user/offers/accept-driver", {
                token, body: { bookingId: rideId, driverId: driver.id },
            }), { allow: [200, 201, 400, 404] }); // shape depends on fleet state

        // Simulate driver acceptance directly so chat becomes usable.
        await prisma.rideRequest.update({
            where: { id: rideId },
            data: { driverId: driver.id, status: "accepted" },
        });

        record("offers.track-driver", "POST", "/apimobile/user/offers/track-driver",
            await req("POST", "/apimobile/user/offers/track-driver", {
                token, body: { bookingId: rideId },
            }));

        record("offers.trip-status", "GET", `/apimobile/user/offers/trip-status/${rideId}`,
            await req("GET", `/apimobile/user/offers/trip-status/${rideId}`, { token }));

        record("offers.active-ride", "GET", "/apimobile/user/offers/active-ride",
            await req("GET", "/apimobile/user/offers/active-ride", { token }));

        record("offers.sos", "POST", "/apimobile/user/offers/sos",
            await req("POST", "/apimobile/user/offers/sos", {
                token,
                body: { rideRequestId: rideId, latitude: 30.0444, longitude: 31.2357, note: "E2E SOS test" },
            }), { allow: [200, 201] });

        record("offers.tip", "POST", "/apimobile/user/offers/tip",
            await req("POST", "/apimobile/user/offers/tip", {
                token,
                body: { rideRequestId: rideId, amount: 5 },
            }), { allow: [200, 201] });

        record("my-bookings.details", "GET", `/apimobile/user/my-bookings/${rideId}`,
            await req("GET", `/apimobile/user/my-bookings/${rideId}`, { token }));
    }

    // ── 6. RIDE CHAT (new feature) ───────────────────────────────────────
    if (rideId) {
        console.log(Y("\n[6] Ride chat (rider ⇄ driver)"));

        // Rider sends a message
        record("chat.rider.send", "POST", `/apimobile/chat/rides/${rideId}/messages`,
            await req("POST", `/apimobile/chat/rides/${rideId}/messages`, {
                token, body: { message: "Hi, I am at the main gate (test)" },
            }), { allow: [201] });

        // Driver sends a message
        record("chat.driver.send", "POST", `/apimobile/chat/rides/${rideId}/messages`,
            await req("POST", `/apimobile/chat/rides/${rideId}/messages`, {
                token: driverToken, body: { message: "On my way, 3 minutes (test)" },
            }), { allow: [201] });

        // Rider reads history
        record("chat.rider.history", "GET", `/apimobile/chat/rides/${rideId}/messages`,
            await req("GET", `/apimobile/chat/rides/${rideId}/messages`, { token, query: { limit: 30 } }));

        // Rider marks as read + unread count
        record("chat.rider.mark-read", "POST", `/apimobile/chat/rides/${rideId}/read`,
            await req("POST", `/apimobile/chat/rides/${rideId}/read`, { token }));
        record("chat.rider.unread", "GET", `/apimobile/chat/rides/${rideId}/unread-count`,
            await req("GET", `/apimobile/chat/rides/${rideId}/unread-count`, { token }));

        // Stranger must be rejected
        const stranger = await prisma.user.create({
            data: {
                firstName: "Stranger", lastName: "Probe",
                contactNumber: `9900${Date.now()}`.slice(-11),
                password: "x", userType: "rider", status: "active", isVerified: true,
            },
        });
        const strangerToken = generateToken(stranger.id);
        const strangerTry = await req("POST", `/apimobile/chat/rides/${rideId}/messages`, {
            token: strangerToken, body: { message: "I should not be allowed" },
        });
        record("chat.stranger.rejected", "POST", `/apimobile/chat/rides/${rideId}/messages`,
            strangerTry, { allow: [403], note: "expects 403" });
        await prisma.user.delete({ where: { id: stranger.id } }).catch(() => {});
    }

    // ── 7. Cancel / end trip ─────────────────────────────────────────────
    if (rideId) {
        console.log(Y("\n[7] Trip cancel/end"));
        record("offers.cancel-trip", "POST", "/apimobile/user/offers/cancel-trip",
            await req("POST", "/apimobile/user/offers/cancel-trip", {
                token, body: { bookingId: rideId, reason: "E2E test cleanup" },
            }), { allow: [200, 201, 400] });

        // Chat must now be CLOSED (read-only)
        const postCancelSend = await req("POST", `/apimobile/chat/rides/${rideId}/messages`, {
            token, body: { message: "after cancel" },
        });
        record("chat.closed-after-cancel", "POST", `/apimobile/chat/rides/${rideId}/messages`,
            postCancelSend, { allow: [403], note: "expects 403" });
    }

    // ── 8. My bookings / review ──────────────────────────────────────────
    console.log(Y("\n[8] My bookings"));
    record("my-bookings.list", "GET", "/apimobile/user/my-bookings",
        await req("GET", "/apimobile/user/my-bookings", { token }));
    record("my-bookings.filter", "GET", "/apimobile/user/my-bookings/filter",
        await req("GET", "/apimobile/user/my-bookings/filter", { token, query: { status: "pending" } }));

    // ── 9. Wallet ────────────────────────────────────────────────────────
    console.log(Y("\n[9] Wallet"));
    record("wallet.operations", "GET", "/apimobile/user/wallet/operations",
        await req("GET", "/apimobile/user/wallet/operations", { token }));
    record("wallet.operations.filter", "GET", "/apimobile/user/wallet/operations/filter",
        await req("GET", "/apimobile/user/wallet/operations/filter", { token, query: { type: "all" } }));

    // ── 10. Profile ──────────────────────────────────────────────────────
    console.log(Y("\n[10] Profile"));
    record("profile.me", "GET", "/apimobile/user/profile",
        await req("GET", "/apimobile/user/profile", { token }));

    // ── 11. Addresses ────────────────────────────────────────────────────
    console.log(Y("\n[11] Addresses"));
    record("addresses.list", "GET", "/apimobile/user/addresses",
        await req("GET", "/apimobile/user/addresses", { token }));
    const addAddr = await req("POST", "/apimobile/user/addresses", {
        token,
        body: { label: "Work", address: "Smart Village, 6th Oct", latitude: 30.07, longitude: 30.97 },
    });
    record("addresses.add", "POST", "/apimobile/user/addresses", addAddr, { allow: [200, 201] });
    const newAddrId = addAddr.body && addAddr.body.data && (addAddr.body.data.id || addAddr.body.data.address_id);
    if (newAddrId) {
        record("addresses.delete", "DELETE", `/apimobile/user/addresses/${newAddrId}`,
            await req("DELETE", `/apimobile/user/addresses/${newAddrId}`, { token }));
    }

    // ── 12. Bank cards ───────────────────────────────────────────────────
    console.log(Y("\n[12] Bank cards"));
    record("cards.list", "GET", "/apimobile/user/bank-cards",
        await req("GET", "/apimobile/user/bank-cards", { token }));
    const addCard = await req("POST", "/apimobile/user/add-bank-card", {
        token,
        body: {
            cardHolder: "E2E Rider",
            cardNumber: "4111111111111111",
            expiryMonth: 12, expiryYear: 2032, cvv: "123", brand: "VISA",
        },
    });
    record("cards.add", "POST", "/apimobile/user/add-bank-card", addCard, { allow: [200, 201] });

    // ── 13. Static / notifications ───────────────────────────────────────
    console.log(Y("\n[13] Static / notifications"));
    record("static.privacy", "GET", "/apimobile/user/static/privacy-policy",
        await req("GET", "/apimobile/user/static/privacy-policy", { token }));
    record("static.help-center", "GET", "/apimobile/user/static/help-center",
        await req("GET", "/apimobile/user/static/help-center", { token }));
    record("static.terms", "GET", "/apimobile/user/static/terms",
        await req("GET", "/apimobile/user/static/terms", { token }));
    record("notifications", "GET", "/apimobile/user/notifications",
        await req("GET", "/apimobile/user/notifications", { token }));
    record("notifications.unread-count", "GET", "/apimobile/user/notifications/unread-count",
        await req("GET", "/apimobile/user/notifications/unread-count", { token }));
    record("notifications.read-all", "POST", "/apimobile/user/notifications/read-all",
        await req("POST", "/apimobile/user/notifications/read-all", { token }));

    // ── 14. Negotiation ──────────────────────────────────────────────────
    console.log(Y("\n[14] Negotiation"));
    record("negotiation.settings", "GET", "/apimobile/user/negotiation/settings",
        await req("GET", "/apimobile/user/negotiation/settings"));

    // ── 15. Device token / change password ───────────────────────────────
    console.log(Y("\n[15] Device token & auth helpers"));
    record("device-token.register", "POST", "/apimobile/user/device-token",
        await req("POST", "/apimobile/user/device-token", {
            token,
            body: { fcmToken: "E2E_FCM_TOKEN_" + Date.now(), playerId: "E2E_PLAYER", appVersion: "1.0.0", platform: "android" },
        }));
    record("auth.change-password", "POST", "/apimobile/user/auth/change-password",
        await req("POST", "/apimobile/user/auth/change-password", {
            token,
            body: { currentPassword: RIDER_PASSWORD, newPassword: RIDER_PASSWORD },
        }),
        { allow: [200, 401] }); // may return 401 on second run if password already changed

    // ── 16. Coupons / Referral / SOS contacts / Complaints ───────────────
    console.log(Y("\n[16] Coupons, referral, SOS contacts, complaints"));
    record("coupons.validate", "POST", "/apimobile/user/coupons/validate",
        await req("POST", "/apimobile/user/coupons/validate", {
            token, body: { code: "E2E10", amount: 100 },
        }));
    record("coupons.validate.invalid", "POST", "/apimobile/user/coupons/validate (bad)",
        await req("POST", "/apimobile/user/coupons/validate", {
            token, body: { code: "NOT_A_REAL_CODE_123" },
        }),
        { allow: [404] });

    record("referral.get", "GET", "/apimobile/user/referral",
        await req("GET", "/apimobile/user/referral", { token }));

    record("sos-contacts.list", "GET", "/apimobile/user/sos-contacts",
        await req("GET", "/apimobile/user/sos-contacts", { token }));
    const addSos = await req("POST", "/apimobile/user/sos-contacts", {
        token, body: { name: "E2E Friend", nameAr: "صديق", contactNumber: "01555555555" },
    });
    record("sos-contacts.add", "POST", "/apimobile/user/sos-contacts", addSos, { allow: [200, 201] });
    const newSosId = addSos.body && addSos.body.data && addSos.body.data.id;
    if (newSosId) {
        record("sos-contacts.delete", "DELETE", `/apimobile/user/sos-contacts/${newSosId}`,
            await req("DELETE", `/apimobile/user/sos-contacts/${newSosId}`, { token }));
    }

    const compBody = rideId
        ? { subject: "E2E complaint", description: "Auto-generated from E2E test.", rideRequestId: rideId, driverId: driver.id }
        : { subject: "E2E complaint", description: "Auto-generated from E2E test." };
    record("complaints.create", "POST", "/apimobile/user/complaints",
        await req("POST", "/apimobile/user/complaints", { token, body: compBody }),
        { allow: [200, 201] });
    record("complaints.list", "GET", "/apimobile/user/complaints",
        await req("GET", "/apimobile/user/complaints", { token }));

    // ── 17. Logout ───────────────────────────────────────────────────────
    console.log(Y("\n[17] Logout"));
    record("auth.logout", "POST", "/apimobile/user/logout",
        await req("POST", "/apimobile/user/logout", { token }));

    // ── Report ───────────────────────────────────────────────────────────
    const pass = results.filter((r) => r.ok).length;
    const fail = results.length - pass;

    console.log("\n" + "═".repeat(90));
    console.log(B(" SUMMARY"));
    console.log("═".repeat(90));
    console.log(` Total: ${results.length}   ${G("Pass: " + pass)}   ${fail ? R("Fail: " + fail) : G("Fail: 0")}`);
    if (fail > 0) {
        console.log("\n Failures:");
        results.filter((r) => !r.ok).forEach((r) => {
            console.log(`   ${R("✗")} ${r.method} ${r.path}  [${r.status}] ${r.note}`);
        });
    }
    console.log("═".repeat(90) + "\n");

    process.exitCode = fail > 0 ? 1 : 0;
}

main()
    .catch((e) => {
        console.error(R("\n✗ Runner crashed:"), e);
        process.exit(2);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
