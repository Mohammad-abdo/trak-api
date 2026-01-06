import prisma from "../utils/prisma.js";

// @desc    Get dispatch list (ride requests)
// @route   GET /api/dispatch
// @access  Private (Admin)
export const getDispatchList = async (req, res) => {
    try {
        const { status, per_page = 10, page = 1 } = req.query;

        const where = {};
        if (status) {
            where.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        const [rideRequests, total] = await Promise.all([
            prisma.rideRequest.findMany({
                where,
                skip,
                take: parseInt(per_page),
                include: {
                    rider: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            contactNumber: true,
                        },
                    },
                    driver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            contactNumber: true,
                        },
                    },
                    service: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.rideRequest.count({ where }),
        ]);

        res.json({
            success: true,
            data: rideRequests,
            pagination: {
                total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                total_pages: Math.ceil(total / parseInt(per_page)),
            },
        });
    } catch (error) {
        console.error("Get dispatch list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Assign driver to ride request
// @route   POST /api/dispatch/:id/assign-driver
// @access  Private (Admin)
export const assignDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { driver_id } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: parseInt(id) },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        // Check if driver exists and is available
        const driver = await prisma.user.findFirst({
            where: {
                id: parseInt(driver_id),
                userType: "driver",
                status: "active",
            },
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found or not available",
            });
        }

        const updatedRideRequest = await prisma.rideRequest.update({
            where: { id: parseInt(id) },
            data: {
                driverId: parseInt(driver_id),
                status: "accepted",
            },
        });

        res.json({
            success: true,
            data: updatedRideRequest,
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

// @desc    Create dispatch (ride request)
// @route   POST /api/dispatch
// @access  Private (Admin)
export const createDispatch = async (req, res) => {
    try {
        const {
            rider_id,
            service_id,
            start_latitude,
            start_longitude,
            start_address,
            end_latitude,
            end_longitude,
            end_address,
            driver_id,
            total_amount,
        } = req.body;

        const rideRequest = await prisma.rideRequest.create({
            data: {
                riderId: parseInt(rider_id),
                serviceId: service_id ? parseInt(service_id) : null,
                startLatitude: start_latitude,
                startLongitude: start_longitude,
                startAddress: start_address,
                endLatitude: end_latitude,
                endLongitude: end_longitude,
                endAddress: end_address,
                driverId: driver_id ? parseInt(driver_id) : null,
                totalAmount: total_amount || 0,
                status: driver_id ? "accepted" : "pending",
            },
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                driver: driver_id
                    ? {
                          select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                          },
                      }
                    : undefined,
            },
        });

        res.status(201).json({
            success: true,
            data: rideRequest,
            message: "Ride request created successfully",
        });
    } catch (error) {
        console.error("Create dispatch error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Check zone price
// @route   POST /api/dispatch/check-zone-price
// @access  Private (Admin)
export const checkZonePrice = async (req, res) => {
    try {
        const { zone_pickup_id, zone_dropoff_id, service_id } = req.body;

        if (!zone_pickup_id || !zone_dropoff_id) {
            return res.status(400).json({
                success: false,
                message: "Zone pickup ID and zone dropoff ID are required",
            });
        }

        const zonePrice = await prisma.zonePrice.findFirst({
            where: {
                zonePickup: parseInt(zone_pickup_id),
                zoneDropoff: parseInt(zone_dropoff_id),
            },
            include: {
                pickupZone: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                dropoffZone: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        // Check if service is included in serviceIds
        let isServiceApplicable = true;
        if (service_id && zonePrice?.serviceIds) {
            const serviceIds = Array.isArray(zonePrice.serviceIds) 
                ? zonePrice.serviceIds 
                : JSON.parse(zonePrice.serviceIds || '[]');
            isServiceApplicable = serviceIds.includes(parseInt(service_id));
        }

        if (zonePrice && isServiceApplicable) {
            res.json({
                success: true,
                data: {
                    price: zonePrice.price,
                    zonePrice: zonePrice,
                    pickupZone: zonePrice.pickupZone,
                    dropoffZone: zonePrice.dropoffZone,
                },
                message: "Zone price found",
            });
        } else {
            res.json({
                success: false,
                data: null,
                message: "No zone price found for this route",
            });
        }
    } catch (error) {
        console.error("Check zone price error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Save zone fare
// @route   POST /api/dispatch/save-zone-fare
// @access  Private (Admin)
export const saveZoneFare = async (req, res) => {
    try {
        const { zone_pickup_id, zone_dropoff_id, service_ids, price } = req.body;

        if (!zone_pickup_id || !zone_dropoff_id || price === undefined) {
            return res.status(400).json({
                success: false,
                message: "Zone pickup ID, zone dropoff ID, and price are required",
            });
        }

        // Convert service_ids to JSON if it's an array
        let serviceIdsJson = null;
        if (service_ids) {
            serviceIdsJson = Array.isArray(service_ids) 
                ? service_ids 
                : JSON.parse(service_ids || '[]');
        }

        // Check if zone price already exists
        const existingZonePrice = await prisma.zonePrice.findFirst({
            where: {
                zonePickup: parseInt(zone_pickup_id),
                zoneDropoff: parseInt(zone_dropoff_id),
            },
        });

        let zonePrice;
        if (existingZonePrice) {
            // Update existing
            zonePrice = await prisma.zonePrice.update({
                where: { id: existingZonePrice.id },
                data: {
                    price: parseFloat(price),
                    serviceIds: serviceIdsJson,
                },
                include: {
                    pickupZone: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    dropoffZone: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
        } else {
            // Create new
            zonePrice = await prisma.zonePrice.create({
                data: {
                    zonePickup: parseInt(zone_pickup_id),
                    zoneDropoff: parseInt(zone_dropoff_id),
                    price: parseFloat(price),
                    serviceIds: serviceIdsJson,
                },
                include: {
                    pickupZone: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    dropoffZone: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
        }

        res.json({
            success: true,
            data: zonePrice,
            message: "Zone fare saved successfully",
        });
    } catch (error) {
        console.error("Save zone fare error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get supplier payout
// @route   GET /api/dispatch/supplier-payout
// @access  Private (Admin)
export const getSupplierPayout = async (req, res) => {
    try {
        const { from_date, to_date, fleet_id } = req.query;

        const where = {
            status: "completed",
        };

        if (from_date) {
            where.createdAt = { gte: new Date(from_date) };
        }
        if (to_date) {
            where.createdAt = {
                ...where.createdAt,
                lte: new Date(to_date),
            };
        }

        // Get completed rides with fleet information
        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        fleetId: true,
                    },
                },
                payments: {
                    select: {
                        amount: true,
                        paymentMethod: true,
                    },
                },
                service: {
                    select: {
                        id: true,
                        name: true,
                        fleetCommission: true,
                        adminCommission: true,
                        commissionType: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Filter by fleet if specified
        let filteredRides = rideRequests;
        if (fleet_id) {
            filteredRides = rideRequests.filter(
                (ride) => ride.driver?.fleetId === parseInt(fleet_id)
            );
        }

        // Calculate payouts by fleet
        const fleetPayouts = {};
        filteredRides.forEach((ride) => {
            const fleetId = ride.driver?.fleetId;
            if (!fleetId) return;

            const totalAmount = ride.payments.reduce((sum, p) => sum + p.amount, 0) || 0;
            const service = ride.service;

            let fleetCommission = 0;
            if (service) {
                if (service.commissionType === "percentage" && service.fleetCommission) {
                    fleetCommission = (totalAmount * service.fleetCommission) / 100;
                } else if (service.commissionType === "fixed" && service.fleetCommission) {
                    fleetCommission = service.fleetCommission;
                }
            }

            if (!fleetPayouts[fleetId]) {
                fleetPayouts[fleetId] = {
                    fleetId,
                    totalRides: 0,
                    totalRevenue: 0,
                    totalCommission: 0,
                    payout: 0,
                };
            }

            fleetPayouts[fleetId].totalRides++;
            fleetPayouts[fleetId].totalRevenue += totalAmount;
            fleetPayouts[fleetId].totalCommission += fleetCommission;
            fleetPayouts[fleetId].payout += totalAmount - fleetCommission;
        });

        // Get fleet details
        const fleetIds = Object.keys(fleetPayouts).map(Number);
        const fleets = await prisma.user.findMany({
            where: {
                id: { in: fleetIds },
                userType: "fleet",
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
            },
        });

        // Combine fleet details with payout data
        const payoutData = Object.values(fleetPayouts).map((payout) => {
            const fleet = fleets.find((f) => f.id === payout.fleetId);
            return {
                ...payout,
                fleet: fleet || null,
            };
        });

        res.json({
            success: true,
            data: {
                payouts: payoutData,
                summary: {
                    totalFleets: payoutData.length,
                    totalRides: payoutData.reduce((sum, p) => sum + p.totalRides, 0),
                    totalRevenue: payoutData.reduce((sum, p) => sum + p.totalRevenue, 0),
                    totalCommission: payoutData.reduce((sum, p) => sum + p.totalCommission, 0),
                    totalPayout: payoutData.reduce((sum, p) => sum + p.payout, 0),
                },
            },
        });
    } catch (error) {
        console.error("Get supplier payout error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



