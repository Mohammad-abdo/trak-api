/**
 * E2E Test Seeder
 * ---------------
 * Idempotently creates all fixtures needed by scripts/testUserEndpoints.js:
 *   - Required lookup data (ServiceCategory, VehicleCategory, PricingRule,
 *     PaymentMethod, ShipmentSize, ShipmentWeight, Setting for negotiation)
 *   - One fully-detailed rider with wallet + 1 address + 1 bank card
 *   - One fully-detailed driver (active, verified, online, with vehicle +
 *     bank account + wallet + one document)
 *
 * Run:  npm run test:seed-e2e
 *
 * Prints the credentials at the end so you can use them in Postman/Swagger
 * or for scripts/testUserEndpoints.js.
 */

import bcrypt from "bcryptjs";
import prisma from "../utils/prisma.js";

const LOG = (...a) => console.log("[seed-e2e]", ...a);

const RIDER = {
    firstName: "E2E",
    lastName: "Rider",
    email: "e2e.rider@offergo.test",
    phone: "0100000E2E1", // 11 chars — unique, test-only
    password: "E2ERider@123",
};

const DRIVER = {
    firstName: "E2E",
    lastName: "Driver",
    email: "e2e.driver@offergo.test",
    phone: "0100000E2E2",
    password: "E2EDriver@123",
};

async function ensureServiceCategory() {
    const existing = await prisma.serviceCategory.findFirst({
        where: { name: "E2E Ride" },
    });
    if (existing) return existing;
    return prisma.serviceCategory.create({
        data: {
            name: "E2E Ride",
            nameAr: "اختبار E2E",
            slug: "e2e-ride",
            description: "Auto-seeded for E2E tests",
            status: 1,
        },
    });
}

async function ensureService(regionId = null) {
    const existing = await prisma.service.findFirst({ where: { name: "E2E Service" } });
    if (existing) return existing;
    return prisma.service.create({
        data: {
            name: "E2E Service",
            nameAr: "خدمة E2E",
            status: 1,
            ...(regionId ? { regionId } : {}),
        },
    });
}

async function ensureVehicleCategory(serviceCategoryId) {
    const existing = await prisma.vehicleCategory.findFirst({
        where: { name: "E2E Sedan", serviceCategoryId },
    });
    if (existing) return existing;
    return prisma.vehicleCategory.create({
        data: {
            serviceCategoryId,
            name: "E2E Sedan",
            nameAr: "سيدان E2E",
            slug: "e2e-sedan",
            capacity: 4,
            maxLoad: 150,
            status: 1,
        },
    });
}

async function ensurePricingRule(vehicleCategoryId) {
    const existing = await prisma.pricingRule.findFirst({
        where: { vehicleCategoryId, status: 1 },
    });
    if (existing) return existing;
    return prisma.pricingRule.create({
        data: {
            vehicleCategoryId,
            baseFare: 15,
            minimumFare: 20,
            baseDistance: 2,
            perDistanceAfterBase: 5,
            perMinuteDrive: 1,
            perMinuteWait: 0.5,
            cancellationFee: 10,
            status: 1,
        },
    });
}

async function ensurePaymentMethod() {
    const existing = await prisma.paymentMethod.findFirst({ where: { code: "cash" } });
    if (existing) return existing;
    return prisma.paymentMethod.create({
        data: { name: "Cash", nameAr: "نقدًا", code: "cash", status: 1, sortOrder: 1 },
    });
}

async function ensureShipmentExtras(vehicleCategoryId) {
    let size = await prisma.shipmentSize.findFirst({ where: { vehicleCategoryId } });
    if (!size) {
        size = await prisma.shipmentSize.create({
            data: { vehicleCategoryId, name: "Small", priceModifier: 0, status: 1 },
        });
    }
    let weight = await prisma.shipmentWeight.findFirst({ where: { vehicleCategoryId } });
    if (!weight) {
        weight = await prisma.shipmentWeight.create({
            data: { vehicleCategoryId, name: "<10kg", priceModifier: 0, status: 1 },
        });
    }
    return { size, weight };
}

async function ensureNegotiationSettings() {
    const pairs = [
        ["ride_negotiation_enabled", "true"],
        ["ride_negotiation_max_percent", "20"],
        ["ride_negotiation_max_rounds", "3"],
        ["ride_negotiation_timeout_seconds", "90"],
    ];
    for (const [key, value] of pairs) {
        await prisma.setting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
        });
    }
}

async function upsertRider(serviceId) {
    const password = await bcrypt.hash(RIDER.password, 10);
    const existing = await prisma.user.findFirst({ where: { contactNumber: RIDER.phone } });
    const data = {
        firstName: RIDER.firstName,
        lastName: RIDER.lastName,
        email: RIDER.email,
        contactNumber: RIDER.phone,
        countryCode: "+20",
        gender: "male",
        address: "123 Test Street, Cairo, Egypt",
        password,
        userType: "rider",
        status: "active",
        isVerified: true,
        isOnline: false,
        isAvailable: true,
        latitude: "30.0444",
        longitude: "31.2357",
        referralCode: `USRE2E${existing ? existing.id : Date.now()}`,
        serviceId,
    };
    const user = existing
        ? await prisma.user.update({ where: { id: existing.id }, data })
        : await prisma.user.create({ data });

    await prisma.wallet.upsert({
        where: { userId: user.id },
        create: { userId: user.id, balance: 500, currency: "EGP" },
        update: { balance: 500 },
    });

    const addr = await prisma.userAddress.findFirst({ where: { userId: user.id } });
    if (!addr) {
        await prisma.userAddress.create({
            data: {
                userId: user.id,
                title: "Home",
                address: "123 Test Street, Cairo, Egypt",
                latitude: "30.0444",
                longitude: "31.2357",
                isDefault: true,
            },
        });
    }

    const card = await prisma.userBankCard.findFirst({ where: { userId: user.id } });
    if (!card) {
        await prisma.userBankCard.create({
            data: {
                userId: user.id,
                cardHolderName: `${RIDER.firstName} ${RIDER.lastName}`,
                lastFourDigits: "4242",
                brand: "VISA",
                expiryMonth: 12,
                expiryYear: 2032,
                isDefault: true,
            },
        });
    }

    return user;
}

async function upsertDriver(serviceId) {
    const password = await bcrypt.hash(DRIVER.password, 10);
    const existing = await prisma.user.findFirst({ where: { contactNumber: DRIVER.phone } });
    const data = {
        firstName: DRIVER.firstName,
        lastName: DRIVER.lastName,
        email: DRIVER.email,
        contactNumber: DRIVER.phone,
        countryCode: "+20",
        gender: "male",
        address: "456 Driver Ave, Cairo, Egypt",
        password,
        userType: "driver",
        status: "active",
        isVerified: true,
        isVerifiedDriver: true,
        isOnline: true,
        isAvailable: true,
        latitude: "30.0500",
        longitude: "31.2400",
        referralCode: `DRVE2E${existing ? existing.id : Date.now()}`,
        serviceId,
    };
    const driver = existing
        ? await prisma.user.update({ where: { id: existing.id }, data })
        : await prisma.user.create({ data });

    await prisma.wallet.upsert({
        where: { userId: driver.id },
        create: { userId: driver.id, balance: 200, currency: "EGP" },
        update: { balance: 200 },
    });

    const detail = await prisma.userDetail.findUnique({ where: { userId: driver.id } }).catch(() => null);
    if (!detail) {
        await prisma.userDetail.create({
            data: {
                userId: driver.id,
                carModel: "Toyota Corolla",
                carColor: "White",
                carPlateNumber: "E2E-1234",
                carProductionYear: 2022,
            },
        });
    }

    const bank = await prisma.userBankAccount.findUnique({ where: { userId: driver.id } }).catch(() => null);
    if (!bank) {
        await prisma.userBankAccount.create({
            data: {
                userId: driver.id,
                bankName: "Test Bank",
                accountHolderName: `${DRIVER.firstName} ${DRIVER.lastName}`,
                accountNumber: "1234567890",
                bankIban: "EG380019000500000000263180002",
                bankSwift: "TESTEGCX",
            },
        });
    }

    return driver;
}

async function ensureCoupon() {
    const existing = await prisma.coupon.findFirst({ where: { code: "E2E10" } });
    if (existing) return existing;
    return await prisma.coupon.create({
        data: {
            code: "E2E10",
            title: "10% off E2E",
            titleAr: "خصم 10% (اختبار)",
            couponType: "public",
            usageLimitPerRider: 100,
            discountType: "percentage",
            discount: 10,
            minimumAmount: 0,
            maximumDiscount: 50,
            status: 1,
            description: "Seeded E2E test coupon",
            descriptionAr: "كوبون اختبار",
        },
    });
}

async function ensureSosContact(userId) {
    const existing = await prisma.sos.findFirst({ where: { userId, contactNumber: "01999999999" } });
    if (existing) return existing;
    return await prisma.sos.create({
        data: {
            userId,
            name: "E2E Emergency",
            nameAr: "اختبار الطوارئ",
            contactNumber: "01999999999",
            status: 1,
        },
    });
}

async function main() {
    LOG("starting E2E seed…");

    const serviceCategory = await ensureServiceCategory();
    LOG(`serviceCategory#${serviceCategory.id}`);

    const service = await ensureService();
    LOG(`service#${service.id}`);

    const vehicleCategory = await ensureVehicleCategory(serviceCategory.id);
    LOG(`vehicleCategory#${vehicleCategory.id}`);

    const pricingRule = await ensurePricingRule(vehicleCategory.id);
    LOG(`pricingRule#${pricingRule.id} baseFare=${pricingRule.baseFare}`);

    const paymentMethod = await ensurePaymentMethod();
    LOG(`paymentMethod#${paymentMethod.id} code=${paymentMethod.code}`);

    const { size, weight } = await ensureShipmentExtras(vehicleCategory.id);
    LOG(`shipmentSize#${size.id} shipmentWeight#${weight.id}`);

    await ensureNegotiationSettings();
    LOG("negotiation settings upserted");

    await ensureCoupon();
    LOG("coupon E2E10 upserted");

    const rider = await upsertRider(service.id);
    LOG(`rider#${rider.id} phone=${rider.contactNumber}`);

    await ensureSosContact(rider.id);
    LOG(`sos contact seeded for rider#${rider.id}`);

    const driver = await upsertDriver(service.id);
    LOG(`driver#${driver.id} phone=${driver.contactNumber}`);

    console.log("\n══════════════════════════════════════════════════════════════");
    console.log(" E2E TEST CREDENTIALS");
    console.log("══════════════════════════════════════════════════════════════");
    console.log(" RIDER  id=" + rider.id);
    console.log("        phone=" + RIDER.phone);
    console.log("        password=" + RIDER.password);
    console.log(" DRIVER id=" + driver.id);
    console.log("        phone=" + DRIVER.phone);
    console.log("        password=" + DRIVER.password);
    console.log(" Vehicle category id = " + vehicleCategory.id);
    console.log(" Service id          = " + service.id);
    console.log(" Shipment size id    = " + size.id);
    console.log(" Shipment weight id  = " + weight.id);
    console.log(" Payment method id   = " + paymentMethod.id);
    console.log("══════════════════════════════════════════════════════════════\n");
}

main()
    .catch((e) => {
        console.error("[seed-e2e] FAILED:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
