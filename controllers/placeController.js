import axios from "axios";

// @desc    Get place autocomplete suggestions
// @route   GET /api/places/autocomplete
// @access  Public
export const getPlaceAutocomplete = async (req, res) => {
    try {
        const { query, location, radius = 50000, language = "en" } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: "Query parameter is required",
            });
        }

        // Get Google Maps API key from settings
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key is not configured",
            });
        }

        // Build request URL
        let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&language=${language}`;

        // Add location bias if provided
        if (location) {
            const [lat, lng] = location.split(",");
            url += `&location=${lat},${lng}&radius=${radius}`;
        }

        // Make request to Google Places API
        const response = await axios.get(url);

        if (response.data.status === "OK" || response.data.status === "ZERO_RESULTS") {
            const predictions = (response.data.predictions || []).map((prediction) => ({
                placeId: prediction.place_id,
                description: prediction.description,
                mainText: prediction.structured_formatting?.main_text || prediction.description,
                secondaryText: prediction.structured_formatting?.secondary_text || "",
                types: prediction.types || [],
            }));

            res.json({
                success: true,
                data: predictions,
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Google Places API error: ${response.data.status}`,
                error: response.data.error_message,
            });
        }
    } catch (error) {
        console.error("Place autocomplete error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get place details
// @route   GET /api/places/details
// @access  Public
export const getPlaceDetails = async (req, res) => {
    try {
        const { place_id, language = "en" } = req.query;

        if (!place_id) {
            return res.status(400).json({
                success: false,
                message: "place_id parameter is required",
            });
        }

        // Get Google Maps API key from settings
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key is not configured",
            });
        }

        // Build request URL with fields to reduce response size
        const fields = [
            "place_id",
            "name",
            "formatted_address",
            "geometry",
            "address_components",
            "types",
            "international_phone_number",
            "website",
            "rating",
            "user_ratings_total",
        ].join(",");

        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=${fields}&key=${apiKey}&language=${language}`;

        // Make request to Google Places API
        const response = await axios.get(url);

        if (response.data.status === "OK") {
            const result = response.data.result;
            const placeDetails = {
                placeId: result.place_id,
                name: result.name,
                formattedAddress: result.formatted_address,
                location: {
                    lat: result.geometry?.location?.lat,
                    lng: result.geometry?.location?.lng,
                },
                addressComponents: result.address_components || [],
                types: result.types || [],
                phoneNumber: result.international_phone_number || "",
                website: result.website || "",
                rating: result.rating || null,
                userRatingsTotal: result.user_ratings_total || 0,
            };

            res.json({
                success: true,
                data: placeDetails,
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Google Places API error: ${response.data.status}`,
                error: response.data.error_message,
            });
        }
    } catch (error) {
        console.error("Place details error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Geocode address to coordinates
// @route   GET /api/places/geocode
// @access  Public
export const geocodeAddress = async (req, res) => {
    try {
        const { address, language = "en" } = req.query;

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Address parameter is required",
            });
        }

        // Get Google Maps API key from settings
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key is not configured",
            });
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&language=${language}`;

        // Make request to Google Geocoding API
        const response = await axios.get(url);

        if (response.data.status === "OK") {
            const results = (response.data.results || []).map((result) => ({
                placeId: result.place_id,
                formattedAddress: result.formatted_address,
                location: {
                    lat: result.geometry.location.lat,
                    lng: result.geometry.location.lng,
                },
                addressComponents: result.address_components || [],
                types: result.types || [],
            }));

            res.json({
                success: true,
                data: results,
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Google Geocoding API error: ${response.data.status}`,
                error: response.data.error_message,
            });
        }
    } catch (error) {
        console.error("Geocode address error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Reverse geocode coordinates to address
// @route   GET /api/places/reverse-geocode
// @access  Public
export const reverseGeocode = async (req, res) => {
    try {
        const { lat, lng, language = "en" } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                success: false,
                message: "Latitude and longitude parameters are required",
            });
        }

        // Get Google Maps API key from settings
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key is not configured",
            });
        }

        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=${language}`;

        // Make request to Google Geocoding API
        const response = await axios.get(url);

        if (response.data.status === "OK") {
            const results = (response.data.results || []).map((result) => ({
                placeId: result.place_id,
                formattedAddress: result.formatted_address,
                location: {
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                },
                addressComponents: result.address_components || [],
                types: result.types || [],
            }));

            res.json({
                success: true,
                data: results,
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Google Geocoding API error: ${response.data.status}`,
                error: response.data.error_message,
            });
        }
    } catch (error) {
        console.error("Reverse geocode error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get distance and duration between two points
// @route   GET /api/places/distance-matrix
// @access  Public
export const getDistanceMatrix = async (req, res) => {
    try {
        const { origins, destinations, mode = "driving", language = "en" } = req.query;

        if (!origins || !destinations) {
            return res.status(400).json({
                success: false,
                message: "Origins and destinations parameters are required",
            });
        }

        // Get Google Maps API key from settings
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "Google Maps API key is not configured",
            });
        }

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&mode=${mode}&key=${apiKey}&language=${language}`;

        // Make request to Google Distance Matrix API
        const response = await axios.get(url);

        if (response.data.status === "OK") {
            const elements = response.data.rows[0]?.elements || [];
            const results = elements.map((element) => ({
                distance: {
                    text: element.distance?.text || "",
                    value: element.distance?.value || 0, // in meters
                },
                duration: {
                    text: element.duration?.text || "",
                    value: element.duration?.value || 0, // in seconds
                },
                status: element.status,
            }));

            res.json({
                success: true,
                data: {
                    originAddresses: response.data.origin_addresses || [],
                    destinationAddresses: response.data.destination_addresses || [],
                    results,
                },
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Google Distance Matrix API error: ${response.data.status}`,
                error: response.data.error_message,
            });
        }
    } catch (error) {
        console.error("Distance matrix error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

