import prisma from "../utils/prisma.js";
import axios from "axios";

// @desc    Get nearby drivers
// @route   GET /api/utilities/near-by-driver
// @access  Public
export const getNearByDrivers = async (req, res) => {
    try {
        const { latitude, longitude, radius = 10 } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude are required",
            });
        }

        // Get all online and available drivers
        const drivers = await prisma.user.findMany({
            where: {
                userType: "driver",
                status: "active",
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
                serviceId: true,
                service: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Calculate distance and filter nearby drivers
        const nearbyDrivers = drivers
            .map((driver) => {
                const distance = calculateDistance(
                    parseFloat(latitude),
                    parseFloat(longitude),
                    parseFloat(driver.latitude),
                    parseFloat(driver.longitude)
                );
                return {
                    ...driver,
                    distance,
                };
            })
            .filter((driver) => driver.distance <= parseFloat(radius))
            .sort((a, b) => a.distance - b.distance);

        res.json({
            success: true,
            data: nearbyDrivers,
        });
    } catch (error) {
        console.error("Get nearby drivers error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

// @desc    Get language table list
// @route   GET /api/utilities/language-table-list
// @access  Public
export const getLanguageTableList = async (req, res) => {
    try {
        // TODO: Implement language tables when models are added
        res.json({
            success: true,
            data: [],
            version_code: "1.0.0",
            default_language_id: 1,
            allow_deliveryman: false,
            rider_version: {
                android_force_update: false,
                android_version_code: "1.0.0",
                appstore_url: "",
                ios_force_update: false,
                ios_version: "1.0.0",
                playstore_url: "",
            },
            driver_version: {
                android_force_update: false,
                android_version_code: "1.0.0",
                appstore_url: "",
                ios_force_update: false,
                ios_version: "1.0.0",
                playstore_url: "",
            },
            crisp_chat_data: {
                crisp_chat_website_id: null,
                is_crisp_chat_enabled: false,
            },
        });
    } catch (error) {
        console.error("Get language table list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Place autocomplete API
// @route   GET /api/utilities/place-autocomplete-api
// @access  Public
export const placeAutoComplete = async (req, res) => {
    try {
        const { input, location } = req.query;

        if (!input) {
            return res.status(400).json({
                success: false,
                message: "Input parameter is required",
            });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key not configured",
            });
        }

        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}`;

        if (location) {
            const [lat, lng] = location.split(",");
            url += `&location=${lat},${lng}&radius=50000`;
        }

        const response = await axios.get(url);
        res.json({
            success: true,
            data: response.data,
        });
    } catch (error) {
        console.error("Place autocomplete error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Place detail API
// @route   GET /api/utilities/place-detail-api
// @access  Public
export const placeDetail = async (req, res) => {
    try {
        const { place_id } = req.query;

        if (!place_id) {
            return res.status(400).json({
                success: false,
                message: "Place ID is required",
            });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key not configured",
            });
        }

        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${apiKey}`;
        const response = await axios.get(url);

        res.json({
            success: true,
            data: response.data,
        });
    } catch (error) {
        console.error("Place detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Snap to roads API
// @route   POST /api/utilities/snap-to-roads
// @access  Public
export const snapToRoads = async (req, res) => {
    try {
        const { path } = req.body;

        if (!path || !Array.isArray(path)) {
            return res.status(400).json({
                success: false,
                message: "Path array is required",
            });
        }

        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key not configured",
            });
        }

        const pathString = path.map((p) => `${p.lat},${p.lng}`).join("|");
        const url = `https://roads.googleapis.com/v1/snapToRoads?path=${pathString}&key=${apiKey}`;

        const response = await axios.get(url);

        res.json({
            success: true,
            data: response.data,
        });
    } catch (error) {
        console.error("Snap to roads error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



