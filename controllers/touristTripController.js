import prisma from "../utils/prisma.js";

// @desc    Get all tourist trips
// @route   GET /api/tourist-trips
// @access  Private
export const getTouristTrips = async (req, res) => {
    try {
        const { status, rider_id, driver_id } = req.query;
        const where = {};

        if (status) {
            where.status = status;
        }
        if (rider_id) {
            where.riderId = parseInt(rider_id);
        }
        if (driver_id) {
            where.driverId = parseInt(driver_id);
        }

        const trips = await prisma.touristTrip.findMany({
            where,
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        contactNumber: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        displayName: true,
                        contactNumber: true,
                    },
                },
                vehicleCategory: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        capacity: true,
                    },
                },
                service: {
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: trips,
        });
    } catch (error) {
        console.error("Get tourist trips error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get tourist trip by ID
// @route   GET /api/tourist-trips/:id
// @access  Private
export const getTouristTripById = async (req, res) => {
    try {
        const { id } = req.params;

        const trip = await prisma.touristTrip.findUnique({
            where: { id: parseInt(id) },
            include: {
                rider: true,
                driver: true,
                vehicleCategory: {
                    include: {
                        pricingRules: true,
                        features: true,
                    },
                },
                service: true,
            },
        });

        if (!trip) {
            return res.status(404).json({
                success: false,
                message: "Tourist trip not found",
            });
        }

        res.json({
            success: true,
            data: trip,
        });
    } catch (error) {
        console.error("Get tourist trip by ID error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create tourist trip
// @route   POST /api/tourist-trips
// @access  Private
export const createTouristTrip = async (req, res) => {
    try {
        const {
            rider_id,
            driver_id,
            vehicle_category_id,
            service_id,
            start_date,
            end_date,
            start_location,
            start_latitude,
            start_longitude,
            destinations,
            total_amount,
            payment_status,
            payment_type,
            requires_dedicated_driver,
            notes,
            notes_ar,
            status,
        } = req.body;

        if (!rider_id || !vehicle_category_id || !start_date || !end_date) {
            return res.status(400).json({
                success: false,
                message: "Rider ID, vehicle category, start date, and end date are required",
            });
        }

        const trip = await prisma.touristTrip.create({
            data: {
                riderId: parseInt(rider_id),
                driverId: driver_id ? parseInt(driver_id) : null,
                vehicleCategoryId: parseInt(vehicle_category_id),
                serviceId: service_id ? parseInt(service_id) : null,
                startDate: new Date(start_date),
                endDate: new Date(end_date),
                startLocation: start_location,
                startLatitude: start_latitude,
                startLongitude: start_longitude,
                destinations: destinations || null,
                totalAmount: total_amount ? parseFloat(total_amount) : 0,
                paymentStatus: payment_status || "pending",
                paymentType: payment_type,
                requiresDedicatedDriver: requires_dedicated_driver || false,
                notes: notes,
                notesAr: notes_ar,
                status: status || "pending",
            },
        });

        res.status(201).json({
            success: true,
            data: trip,
            message: "Tourist trip created successfully",
        });
    } catch (error) {
        console.error("Create tourist trip error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update tourist trip
// @route   PUT /api/tourist-trips/:id
// @access  Private
export const updateTouristTrip = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            driver_id,
            vehicle_category_id,
            service_id,
            start_date,
            end_date,
            start_location,
            start_latitude,
            start_longitude,
            destinations,
            total_amount,
            payment_status,
            payment_type,
            requires_dedicated_driver,
            notes,
            notes_ar,
            status,
        } = req.body;

        const updateData = {};
        if (driver_id !== undefined) updateData.driverId = driver_id ? parseInt(driver_id) : null;
        if (vehicle_category_id) updateData.vehicleCategoryId = parseInt(vehicle_category_id);
        if (service_id !== undefined) updateData.serviceId = service_id ? parseInt(service_id) : null;
        if (start_date) updateData.startDate = new Date(start_date);
        if (end_date) updateData.endDate = new Date(end_date);
        if (start_location !== undefined) updateData.startLocation = start_location;
        if (start_latitude !== undefined) updateData.startLatitude = start_latitude;
        if (start_longitude !== undefined) updateData.startLongitude = start_longitude;
        if (destinations !== undefined) updateData.destinations = destinations;
        if (total_amount !== undefined) updateData.totalAmount = parseFloat(total_amount);
        if (payment_status) updateData.paymentStatus = payment_status;
        if (payment_type !== undefined) updateData.paymentType = payment_type;
        if (requires_dedicated_driver !== undefined) updateData.requiresDedicatedDriver = requires_dedicated_driver;
        if (notes !== undefined) updateData.notes = notes;
        if (notes_ar !== undefined) updateData.notesAr = notes_ar;
        if (status) updateData.status = status;

        const trip = await prisma.touristTrip.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            data: trip,
            message: "Tourist trip updated successfully",
        });
    } catch (error) {
        console.error("Update tourist trip error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Assign driver to tourist trip
// @route   PUT /api/tourist-trips/:id/assign-driver
// @access  Private
export const assignDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { driver_id } = req.body;

        if (!driver_id) {
            return res.status(400).json({
                success: false,
                message: "Driver ID is required",
            });
        }

        const trip = await prisma.touristTrip.update({
            where: { id: parseInt(id) },
            data: {
                driverId: parseInt(driver_id),
                status: "confirmed",
            },
        });

        res.json({
            success: true,
            data: trip,
            message: "Driver assigned successfully",
        });
    } catch (error) {
        console.error("Assign driver error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update tourist trip status
// @route   PUT /api/tourist-trips/:id/status
// @access  Private
export const updateTripStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({
                success: false,
                message: "Status is required",
            });
        }

        const trip = await prisma.touristTrip.update({
            where: { id: parseInt(id) },
            data: { status },
        });

        res.json({
            success: true,
            data: trip,
            message: "Trip status updated successfully",
        });
    } catch (error) {
        console.error("Update trip status error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete tourist trip
// @route   DELETE /api/tourist-trips/:id
// @access  Private
export const deleteTouristTrip = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.touristTrip.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Tourist trip deleted successfully",
        });
    } catch (error) {
        console.error("Delete tourist trip error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
