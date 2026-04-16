import prisma from "../utils/prisma.js";

function parseArgs(argv) {
    const apply = argv.includes("--apply");
    const limitArg = argv.find((a) => a.startsWith("--limit="));
    const limit = limitArg ? Number(limitArg.split("=")[1]) : 500;
    return {
        apply,
        limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 500,
    };
}

function parseServiceData(data) {
    if (!data) return null;
    if (typeof data === "object") return data;
    if (typeof data === "string") {
        try {
            return JSON.parse(data);
        } catch (_) {
            return null;
        }
    }
    return null;
}

async function main() {
    const { apply, limit } = parseArgs(process.argv.slice(2));

    const rides = await prisma.rideRequest.findMany({
        where: {
            serviceId: null,
            vehicleCategoryId: { not: null },
        },
        select: {
            id: true,
            vehicleCategoryId: true,
            serviceData: true,
        },
        orderBy: { id: "asc" },
        take: limit,
    });

    if (!rides.length) {
        console.log("No rides found that need serviceId backfill.");
        return;
    }

    const categoryIds = [...new Set(rides.map((r) => r.vehicleCategoryId).filter(Boolean))];
    const vehicleCategories = await prisma.vehicleCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, serviceCategoryId: true },
    });
    const categoryToServiceMap = new Map(vehicleCategories.map((v) => [v.id, v.serviceCategoryId]));

    const candidates = rides
        .map((ride) => {
            const fromCategory = categoryToServiceMap.get(ride.vehicleCategoryId) ?? null;
            const serviceData = parseServiceData(ride.serviceData);
            const fromServiceData = serviceData?.serviceCategoryId ?? null;
            const serviceId = fromCategory || fromServiceData || null;
            return { rideId: ride.id, serviceId, vehicleCategoryId: ride.vehicleCategoryId };
        })
        .filter((r) => r.serviceId != null);

    console.log(`Scanned rides: ${rides.length}`);
    console.log(`Backfill candidates: ${candidates.length}`);
    console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`);

    if (!apply) {
        console.log("Preview (first 20):");
        for (const item of candidates.slice(0, 20)) {
            console.log(`ride_id=${item.rideId} vehicle_category_id=${item.vehicleCategoryId} -> service_id=${item.serviceId}`);
        }
        console.log("Run with --apply to persist updates.");
        return;
    }

    let updated = 0;
    for (const item of candidates) {
        await prisma.rideRequest.update({
            where: { id: item.rideId },
            data: { serviceId: item.serviceId },
        });
        updated += 1;
    }

    console.log(`Updated rides: ${updated}`);
}

main()
    .catch((err) => {
        console.error("Backfill failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

