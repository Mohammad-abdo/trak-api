import prisma from "../utils/prisma.js";

// @desc    Get demand zones
// @route   GET /api/demand-map/zones
// @access  Private (Admin)
export const getDemandZones = async (req, res) => {
    try {
        const today = new Date();
        // Set to start of day (00:00:00)
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        // Set to end of day (23:59:59.999)
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        // Get today's ride requests (any status with coordinates for demand heatmap)
        const rides = await prisma.rideRequest.findMany({
            where: {
                createdAt: {
                    gte: start,
                    lte: end,
                },
                startLatitude: { not: null },
                startLongitude: { not: null },
            },
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        // Get available drivers
        const drivers = await prisma.user.findMany({
            where: {
                userType: "driver",
                isOnline: true,
                isAvailable: true,
                latitude: { not: null },
                longitude: { not: null },
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                latitude: true,
                longitude: true,
                isOnline: true,
                isAvailable: true,
                status: true,
            },
        });

        // Group rides by location (within 5km radius)
        const zones = [];
        const haversineDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth's radius in km
            const dLat = ((lat2 - lat1) * Math.PI) / 180;
            const dLon = ((lon2 - lon1) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((lat1 * Math.PI) / 180) *
                    Math.cos((lat2 * Math.PI) / 180) *
                    Math.sin(dLon / 2) *
                    Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };

        rides.forEach((ride) => {
            const lat = parseFloat(ride.startLatitude);
            const lng = parseFloat(ride.startLongitude);

            let foundZone = false;
            for (let zone of zones) {
                const distance = haversineDistance(
                    lat,
                    lng,
                    zone.lat,
                    zone.lng
                );
                if (distance <= 5) {
                    zone.rides.push(ride);
                    foundZone = true;
                    break;
                }
            }

            if (!foundZone) {
                zones.push({
                    lat,
                    lng,
                    rides: [ride],
                });
            }
        });

        // Calculate zone intensity
        const finalZones = zones.map((zone) => {
            const rideCount = zone.rides.length;
            let intensity = "green";
            if (rideCount >= 10) intensity = "red";
            else if (rideCount >= 5) intensity = "orange";

            return {
                ...zone,
                rideCount,
                intensity,
            };
        });

        res.json({
            success: true,
            data: {
                zones: finalZones,
                drivers,
            },
        });
    } catch (error) {
        console.error("Get demand zones error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get nearby drivers
// @route   GET /api/demand-map/nearby-drivers
// @access  Private
export const getNearbyDrivers = async (req, res) => {
    try {
        const { latitude, longitude, radius = 50 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required",
            });
        }

        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);
        const radiusKm = parseFloat(radius);

        // Calculate distance using Haversine formula
        const drivers = await prisma.$queryRaw`
            SELECT 
                id,
                first_name as firstName,
                last_name as lastName,
                display_name as displayName,
                status,
                is_online as isOnline,
                is_available as isAvailable,
                last_location_update_at as lastLocationUpdateAt,
                user_type as userType,
                current_heading as currentHeading,
                latitude,
                longitude,
                service_id as serviceId,
                (6371 * acos(
                    cos(radians(${lat})) * 
                    cos(radians(CAST(latitude AS DECIMAL(10, 8)))) * 
                    cos(radians(CAST(longitude AS DECIMAL(10, 8))) - radians(${lng})) + 
                    sin(radians(${lat})) * 
                    sin(radians(CAST(latitude AS DECIMAL(10, 8))))
                )) AS distance
            FROM users
            WHERE user_type = 'driver'
                AND status = 'active'
                AND is_online = 1
                AND is_available = 1
                AND latitude IS NOT NULL
                AND longitude IS NOT NULL
            HAVING distance <= ${radiusKm}
            ORDER BY distance ASC
        `;

        res.json({
            success: true,
            data: drivers,
        });
    } catch (error) {
        console.error("Get nearby drivers error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
