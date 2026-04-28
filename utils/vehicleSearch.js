import prisma from "./prisma.js";
import { calculateDistance } from "./pricingCalculator.js";

/**
 * Check if a point is within a geographic zone
 * Simple implementation: Using radius distance check from center
 * Advanced implementation (Future): Point-in-Polygon check if coordinates stores GeoJSON polygon
 */
export const isPointInZone = (lat, lng, zone) => {
    if (!zone.centerLat || !zone.centerLng || !zone.radius) return false;

    const distance = calculateDistance(lat, lng, zone.centerLat, zone.centerLng);
    return distance <= zone.radius;
};

/**
 * Find available vehicle categories for a specific location
 * Includes logic for finding zones and mapping them to categories
 */
export const findCategoriesByLocation = async (lat, lng) => {
    try {
        // 1. Get all active active zones
        // In a production app with PostGIS, we would do a spatial query here
        // For now, we fetch active zones and filter in memory (suitable for reasonable number of zones)
        const allZones = await prisma.geographicZone.findMany({
            where: { status: 1 },
            include: {
                categoryZones: {
                    where: { status: 1 },
                    include: {
                        vehicleCategory: {
                            where: { status: 1 },
                            include: {
                                pricingRules: {
                                    where: { status: 1 },
                                    take: 1
                                },
                                features: {
                                    where: { status: 1 }
                                }
                            }
                        }
                    }
                }
            }
        });

        // 2. Filter zones that contain the user's location
        const matchedZones = allZones.filter(zone => isPointInZone(lat, lng, zone));

        if (matchedZones.length === 0) {
            return {
                success: true,
                found: false,
                message: "No service zones found for this location",
                categories: []
            };
        }

        // 3. Extract unique available vehicle categories from matched zones
        const categoryMap = new Map();

        matchedZones.forEach(zone => {
            zone.categoryZones.forEach(cz => {
                if (cz.vehicleCategory && !categoryMap.has(cz.vehicleCategory.id)) {
                    // Add zone info to the category for context
                    const categoryWithContext = {
                        ...cz.vehicleCategory,
                        matchedZoneId: zone.id,
                        matchedZoneName: zone.name
                    };
                    categoryMap.set(cz.vehicleCategory.id, categoryWithContext);
                }
            });
        });

        const categories = Array.from(categoryMap.values());

        return {
            success: true,
            found: categories.length > 0,
            categories: categories,
            zones: matchedZones.map(z => ({ id: z.id, name: z.name }))
        };

    } catch (error) {
        console.error('Search Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Search for available drivers nearby with smart expansion
 * @param {number} lat - Pickup latitude
 * @param {number} lng - Pickup longitude
 * @param {number} radiusKm - Initial search radius
 * @param {Object} filters - Optional filters (vehicle types, features)
 */
export const findNearbyDrivers = async (lat, lng, radiusKm = 5, filters = {}) => {
    // NOTE:
    // Driver live location search should ideally use a spatial index (Redis GEO / Mongo / PostGIS).
    // Until that is integrated, we provide a safe DB fallback (online+available drivers with coords)
    // and filter in memory. This avoids placeholder behavior that silently returns nothing.

    // 1. Define search steps (Expand radius if no drivers found)
    const searchSteps = [
        { radius: 3, timeout: 5000 },
        { radius: 5, timeout: 5000 },
        { radius: 10, timeout: 5000 }, // Expanded zone
        { radius: 15, timeout: 5000 }  // Maximum expansion
    ];

    const categoryIds = Array.isArray(filters.categoryIds)
        ? filters.categoryIds.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)
        : [];

    // Fetch a capped set of candidates once (avoid heavy DB work inside the expansion loop).
    // We only read minimal fields needed for distance filtering.
    const candidates = await prisma.user.findMany({
        where: {
            userType: "driver",
            status: "active",
            isOnline: true,
            isAvailable: true,
            latitude: { not: null },
            longitude: { not: null },
            pushNotificationsEnabled: true,
            ...(categoryIds.length > 0 ? { serviceId: { in: categoryIds } } : {}),
        },
        select: { id: true, latitude: true, longitude: true },
        take: 2000,
        orderBy: { id: "desc" },
    });

    // Try each radius step, return early when we find at least one driver.
    for (const step of searchSteps) {
        const radius = step.radius ?? radiusKm;
        const found = [];

        for (const d of candidates) {
            const dLat = parseFloat(d.latitude);
            const dLng = parseFloat(d.longitude);
            if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) continue;
            const dist = calculateDistance(lat, lng, dLat, dLng);
            if (dist <= radius) {
                found.push({ driverId: d.id, distanceKm: Math.round(dist * 100) / 100 });
            }
        }

        if (found.length > 0) {
            return {
                success: true,
                radiusKm: radius,
                count: found.length,
                drivers: found,
            };
        }
    }

    return { success: true, radiusKm: searchSteps.at(-1)?.radius ?? radiusKm, count: 0, drivers: [] };
};
