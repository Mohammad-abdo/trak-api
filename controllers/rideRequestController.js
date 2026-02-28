import prisma from "../utils/prisma.js";
import { generateExcel, generatePDF, generateCSV, formatDate, formatCurrency } from "../utils/exportUtils.js";
import { calculateTripPrice } from "../utils/pricingCalculator.js";
import * as promotionService from "../services/promotionService.js";

// @desc    Create ride request
// @route   POST /api/ride-requests/save-riderequest
// @access  Private
export const createRideRequest = async (req, res) => {
    try {
        const {
            serviceId,
            vehicleCategoryId, // New field
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
            startAddress,
            endAddress,
            distance,
            duration,
            isSchedule,
            scheduleDatetime,
            paymentType,
            couponCode,
            seatCount,
            dropLocation,
        } = req.body;

        let rideData = {
            riderId: req.user.id,
            startLatitude,
            startLongitude,
            endLatitude,
            endLongitude,
            startAddress,
            endAddress,
            distance,
            duration,
            isSchedule,
            scheduleDatetime: scheduleDatetime ? new Date(scheduleDatetime) : null,
            paymentType: paymentType || "cash",
            seatCount: seatCount || 1,
            dropLocation: dropLocation ? JSON.parse(JSON.stringify(dropLocation)) : null,
        };

        if (vehicleCategoryId) {
            // New Flow: Vehicle Category Based
            const priceResult = await calculateTripPrice(
                vehicleCategoryId,
                parseFloat(distance),
                parseFloat(duration)
            );

            if (!priceResult.success) {
                return res.status(400).json({
                    success: false,
                    message: priceResult.error
                });
            }

            // Get Vehicle Category Details
            const vehicleCategory = await prisma.vehicleCategory.findUnique({
                where: { id: parseInt(vehicleCategoryId) },
                include: { serviceCategory: true }
            });

            rideData = {
                ...rideData,
                vehicleCategoryId: parseInt(vehicleCategoryId),
                baseFare: priceResult.breakdown.baseFare,
                minimumFare: priceResult.breakdown.minimumFare,
                baseDistance: priceResult.breakdown.baseDistance,
                perDistance: priceResult.breakdown.perKmRate,
                perDistanceCharge: priceResult.breakdown.distanceCharge,
                perMinuteDrive: 0, // Simplified for now or implicitly included in breakdown
                subtotal: priceResult.totalAmount, // Assuming subtotal = total for now
                totalAmount: priceResult.totalAmount,
                pricingData: JSON.stringify(priceResult.breakdown), // Store detailed breakdown
                serviceData: JSON.stringify({ // Mock service data for legacy compatibility
                    name: vehicleCategory.name,
                    id: vehicleCategory.serviceCategoryId // Linking to service category as service ID proxy
                }),
                serviceId: vehicleCategory.serviceCategoryId // Use service category ID as fallback
            };

        } else if (serviceId) {
            // Legacy Flows
            const service = await prisma.service.findUnique({
                where: { id: serviceId },
            });

            if (!service) {
                return res.status(404).json({
                    success: false,
                    message: "Service not found",
                });
            }

            const baseFare = service.baseFare || 0;
            const perDistanceCharge = (distance - (service.minimumDistance || 0)) * (service.perDistance || 0);
            const perMinuteCharge = duration * (service.perMinuteDrive || 0);
            const subtotal = baseFare + perDistanceCharge + perMinuteCharge;
            const totalAmount = Math.max(subtotal, service.minimumFare || 0);

            rideData = {
                ...rideData,
                serviceId,
                baseFare,
                minimumFare: service.minimumFare,
                baseDistance: service.minimumDistance,
                perDistance: service.perDistance,
                perDistanceCharge,
                perMinuteDrive: service.perMinuteDrive,
                subtotal,
                totalAmount,
                serviceData: JSON.parse(JSON.stringify(service)),
            };
        } else {
            return res.status(400).json({
                success: false,
                message: "Either serviceId or vehicleCategoryId is required"
            });
        }

        // Apply promotion (coupon) if provided
        const promotionResult = await promotionService.applyPromotion({
            userId: req.user.id,
            bookingType: "RIDE",
            vehicleCategoryId: rideData.vehicleCategoryId || null,
            totalPrice: rideData.totalAmount,
            bookingDate: rideData.scheduleDatetime || new Date(),
            code: couponCode || null,
        });
        if (promotionResult.applied) {
            rideData.totalAmount = promotionResult.finalPrice;
            rideData.couponDiscount = promotionResult.discount;
            rideData.couponData = promotionResult.promotion ? JSON.stringify(promotionResult.promotion) : null;
        }

        // Create ride request
        const rideRequest = await prisma.rideRequest.create({
            data: rideData,
        });

        if (promotionResult.applied && promotionResult.promotion?.id) {
            await promotionService.recordPromotionUsage(promotionResult.promotion.id, req.user.id, String(rideRequest.id));
        }

        res.status(201).json({
            success: true,
            message: "Ride request created successfully",
            data: rideRequest,
        });
    } catch (error) {
        console.error("Create ride request error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get ride request list with advanced filtering
// @route   GET /api/ride-requests/riderequest-list
// @access  Private
export const getRideRequestList = async (req, res) => {
    try {
        const {
            status,
            type,
            serviceId,
            isSchedule,
            riderId,
            driverId,
            fromDate,
            toDate,
            paymentStatus,
            paymentMethod,
            rideStatus,
            search,
            per_page = 10,
            page = 1,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const where = {};

        // User type based filtering
        if (req.user.userType === "rider") {
            where.riderId = req.user.id;
        } else if (req.user.userType === "driver") {
            where.driverId = req.user.id;
        }

        // Basic filters
        if (status) {
            if (status === "upcoming") {
                where.datetime = { gte: new Date() };
            } else if (status === "canceled") {
                where.status = "canceled";
            } else {
                where.status = status;
            }
        }

        if (serviceId) where.serviceId = parseInt(serviceId);
        if (isSchedule !== undefined) where.isSchedule = isSchedule === "true" || isSchedule === true;
        if (riderId) where.riderId = parseInt(riderId);
        if (driverId) where.driverId = parseInt(driverId);
        if (rideStatus) where.status = rideStatus;

        // Date range filter
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) {
                where.createdAt.gte = new Date(fromDate);
            }
            if (toDate) {
                const toDateObj = new Date(toDate);
                toDateObj.setHours(23, 59, 59, 999);
                where.createdAt.lte = toDateObj;
            }
        }

        // Search filter (search in addresses)
        if (search) {
            where.OR = [
                { startAddress: { contains: search, mode: "insensitive" } },
                { endAddress: { contains: search, mode: "insensitive" } },
            ];
        }

        // Payment filters
        if (paymentStatus || paymentMethod) {
            where.payments = {
                some: {},
            };
            if (paymentStatus) {
                where.payments.some.paymentStatus = paymentStatus;
            }
            if (paymentMethod) {
                where.payments.some.paymentType = paymentMethod;
            }
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        // Build orderBy
        const orderBy = {};
        orderBy[sortBy] = sortOrder === "asc" ? "asc" : "desc";

        const [rideRequests, total] = await Promise.all([
            prisma.rideRequest.findMany({
                where,
                include: {
                    rider: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            contactNumber: true,
                            email: true,
                        },
                    },
                    driver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            contactNumber: true,
                            email: true,
                        },
                    },
                    service: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    payments: {
                        select: {
                            id: true,
                            paymentStatus: true,
                            paymentType: true,
                            amount: true,
                        },
                        take: 1,
                        orderBy: { createdAt: "desc" },
                    },
                },
                skip,
                take: parseInt(per_page),
                orderBy,
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
        console.error("Get ride request list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get ride request detail
// @route   GET /api/ride-requests/riderequest-detail
// @access  Private
export const getRideRequestDetail = async (req, res) => {
    try {
        const { id } = req.query;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: parseInt(id) },
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        contactNumber: true,
                        email: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        contactNumber: true,
                        email: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                service: {
                    select: {
                        id: true,
                        name: true,
                        baseFare: true,
                    },
                },
            },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        res.json({
            success: true,
            data: rideRequest,
        });
    } catch (error) {
        console.error("Get ride request detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update ride request
// @route   POST /api/ride-requests/riderequest-update/:id
// @access  Private
export const updateRideRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const rideRequest = await prisma.rideRequest.update({
            where: { id: parseInt(id) },
            data: updateData,
        });

        res.json({
            success: true,
            message: "Ride request updated successfully",
            data: rideRequest,
        });
    } catch (error) {
        console.error("Update ride request error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete ride request
// @route   POST /api/ride-requests/riderequest-delete/:id
// @access  Private
export const deleteRideRequest = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.rideRequest.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "Ride request deleted successfully",
        });
    } catch (error) {
        console.error("Delete ride request error:", error);
        if (error.code === "P2025") {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Accept ride request
// @route   POST /api/ride-requests/riderequest-respond
// @access  Private
export const acceptRideRequest = async (req, res) => {
    try {
        const { rideRequestId, accept } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        if (accept) {
            await prisma.rideRequest.update({
                where: { id: rideRequestId },
                data: {
                    driverId: req.user.id,
                    status: "accepted",
                },
            });
        } else {
            const cancelledIds = rideRequest.cancelledDriverIds
                ? JSON.parse(rideRequest.cancelledDriverIds)
                : [];
            cancelledIds.push(req.user.id);

            await prisma.rideRequest.update({
                where: { id: rideRequestId },
                data: {
                    cancelledDriverIds: JSON.stringify(cancelledIds),
                },
            });
        }

        const updatedRideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        res.json({
            success: true,
            message: accept
                ? "Ride request accepted"
                : "Ride request rejected",
            data: updatedRideRequest,
        });
    } catch (error) {
        console.error("Accept ride request error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Complete ride request
// @route   POST /api/ride-requests/complete-riderequest
// @access  Private
export const completeRideRequest = async (req, res) => {
    try {
        const { rideRequestId, tips } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        if (rideRequest.driverId !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to complete this ride",
            });
        }

        const totalAmount = rideRequest.totalAmount + (tips || 0);

        await prisma.rideRequest.update({
            where: { id: rideRequestId },
            data: {
                status: "completed",
                tips: tips || 0,
                totalAmount,
            },
        });

        // Create payment record
        const payment = await prisma.payment.create({
            data: {
                rideRequestId: rideRequest.id,
                userId: rideRequest.riderId,
                driverId: rideRequest.driverId,
                amount: totalAmount,
                paymentType: rideRequest.paymentType,
                paymentStatus:
                    rideRequest.paymentType === "cash" ? "paid" : "pending",
            },
        });

        // Credit driver wallet for cash (أرباح الرحلة)
        if (rideRequest.paymentType === "cash" && rideRequest.driverId && totalAmount > 0) {
            let driverWallet = await prisma.wallet.findUnique({
                where: { userId: rideRequest.driverId },
            });
            if (!driverWallet) {
                driverWallet = await prisma.wallet.create({
                    data: { userId: rideRequest.driverId, balance: 0 },
                });
            }
            const newDriverBalance = driverWallet.balance + totalAmount;
            await prisma.wallet.update({
                where: { id: driverWallet.id },
                data: { balance: newDriverBalance },
            });
            await prisma.walletHistory.create({
                data: {
                    walletId: driverWallet.id,
                    userId: rideRequest.driverId,
                    type: "credit",
                    amount: totalAmount,
                    balance: newDriverBalance,
                    description: "Ride earnings (cash)",
                    transactionType: "ride_earnings",
                    rideRequestId: rideRequest.id,
                },
            });
        }

        const updatedRideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        res.json({
            success: true,
            message: "Ride completed successfully",
            data: updatedRideRequest,
        });
    } catch (error) {
        console.error("Complete ride request error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Verify coupon
// @route   POST /api/ride-requests/verify-coupon
// @access  Private
export const verifyCoupon = async (req, res) => {
    try {
        const { couponCode } = req.body;

        const coupon = await prisma.coupon.findUnique({
            where: { code: couponCode },
        });

        if (!coupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found",
            });
        }

        // TODO: Implement full coupon validation logic
        res.json({
            success: true,
            message: "Coupon verified",
            data: {
                discount: coupon.discount || 0,
                couponCode: coupon.code,
            },
        });
    } catch (error) {
        console.error("Verify coupon error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Apply bid
// @route   POST /api/ride-requests/apply-bid
// @access  Private
export const applyBid = async (req, res) => {
    try {
        const { rideRequestId, bidAmount } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        // Create bid
        await prisma.rideRequestBid.create({
            data: {
                rideRequestId,
                driverId: req.user.id,
                bidAmount,
            },
        });

        await prisma.rideRequest.update({
            where: { id: rideRequestId },
            data: { rideHasBid: true },
        });

        res.json({
            success: true,
            message: "Bid applied successfully",
        });
    } catch (error) {
        console.error("Apply bid error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get bidding drivers
// @route   POST /api/ride-requests/get-bidding-riderequest
// @access  Private
export const getBiddingDrivers = async (req, res) => {
    try {
        const { rideRequestId } = req.body;

        const bids = await prisma.rideRequestBid.findMany({
            where: { rideRequestId },
            include: {
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        res.json({
            success: true,
            data: bids.map((bid) => bid.driver),
        });
    } catch (error) {
        console.error("Get bidding drivers error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Accept bid request
// @route   POST /api/ride-requests/riderequest-bid-respond
// @access  Private
export const acceptBidRequest = async (req, res) => {
    try {
        const { rideRequestId, driverId, accept } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        if (accept) {
            await prisma.rideRequest.update({
                where: { id: rideRequestId },
                data: {
                    driverId,
                    status: "accepted",
                },
            });

            await prisma.rideRequestBid.updateMany({
                where: {
                    rideRequestId,
                    driverId,
                },
                data: {
                    isBidAccept: true,
                },
            });
        }

        const updatedRideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        res.json({
            success: true,
            message: accept ? "Bid accepted" : "Bid rejected",
            data: updatedRideRequest,
        });
    } catch (error) {
        console.error("Accept bid request error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update drop location
// @route   POST /api/ride-requests/riderequest/:id/drop/:index
// @access  Private
export const updateDropLocation = async (req, res) => {
    try {
        const { id, index } = req.params;
        const { latitude, longitude, address } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: parseInt(id) },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        let dropLocations = rideRequest.dropLocation
            ? JSON.parse(JSON.stringify(rideRequest.dropLocation))
            : [];

        if (Array.isArray(dropLocations)) {
            const dropIndex = parseInt(index);
            if (dropIndex >= 0 && dropIndex < dropLocations.length) {
                dropLocations[dropIndex] = {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    address,
                };
            } else {
                dropLocations.push({
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    address,
                });
            }
        } else {
            dropLocations = [
                {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    address,
                },
            ];
        }

        const updatedRideRequest = await prisma.rideRequest.update({
            where: { id: parseInt(id) },
            data: {
                dropLocation: JSON.parse(JSON.stringify(dropLocations)),
            },
        });

        res.json({
            success: true,
            message: "Drop location updated successfully",
            data: updatedRideRequest,
        });
    } catch (error) {
        console.error("Update drop location error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Rate ride
// @route   POST /api/ride-requests/save-ride-rating
// @access  Private
export const rideRating = async (req, res) => {
    try {
        const { rideRequestId, rating, comment, ratingBy } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: rideRequestId },
        });

        if (!rideRequest) {
            return res.status(404).json({
                success: false,
                message: "Ride request not found",
            });
        }

        await prisma.rideRequestRating.create({
            data: {
                rideRequestId,
                riderId: rideRequest.riderId,
                driverId: rideRequest.driverId,
                rating,
                comment,
                ratingBy,
            },
        });

        // Update rating flags
        if (ratingBy === "rider") {
            await prisma.rideRequest.update({
                where: { id: rideRequestId },
                data: { isRiderRated: true },
            });
        } else if (ratingBy === "driver") {
            await prisma.rideRequest.update({
                where: { id: rideRequestId },
                data: { isDriverRated: true },
            });
        }

        res.json({
            success: true,
            message: "Rating saved successfully",
        });
    } catch (error) {
        console.error("Ride rating error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Export ride requests
// @route   GET /api/ride-requests/export
// @access  Private (Admin)
export const exportRideRequests = async (req, res) => {
    try {
        const { status, from_date, to_date, format = 'excel' } = req.query;

        const where = {};
        if (status) where.status = status;
        if (from_date) where.createdAt = { gte: new Date(from_date) };
        if (to_date) {
            where.createdAt = {
                ...where.createdAt,
                lte: new Date(to_date),
            };
        }

        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
                rider: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                driver: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                payments: {
                    select: {
                        amount: true,
                        paymentMethod: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Prepare data for export
        const exportData = rideRequests.map((ride) => ({
            'Ride ID': ride.id,
            'Date': formatDate(ride.createdAt),
            'Rider': ride.rider ? `${ride.rider.firstName || ''} ${ride.rider.lastName || ''}`.trim() : 'N/A',
            'Rider Email': ride.rider?.email || '',
            'Driver': ride.driver ? `${ride.driver.firstName || ''} ${ride.driver.lastName || ''}`.trim() : 'N/A',
            'Driver Email': ride.driver?.email || '',
            'Start Address': ride.startAddress || '',
            'End Address': ride.endAddress || '',
            'Amount': formatCurrency(ride.payments.reduce((sum, p) => sum + p.amount, 0) || 0),
            'Payment Method': ride.payments[0]?.paymentMethod || 'N/A',
            'Status': ride.status,
        }));

        const headers = [
            { key: 'Ride ID', label: 'Ride ID' },
            { key: 'Date', label: 'Date' },
            { key: 'Rider', label: 'Rider' },
            { key: 'Rider Email', label: 'Rider Email' },
            { key: 'Driver', label: 'Driver' },
            { key: 'Driver Email', label: 'Driver Email' },
            { key: 'Start Address', label: 'Start Address' },
            { key: 'End Address', label: 'End Address' },
            { key: 'Amount', label: 'Amount' },
            { key: 'Payment Method', label: 'Payment Method' },
            { key: 'Status', label: 'Status' },
        ];

        const title = 'Ride Requests Report';

        if (format === 'pdf') {
            const pdfBuffer = await generatePDF(exportData, headers, title);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=ride-requests-${Date.now()}.pdf`);
            res.send(pdfBuffer);
        } else if (format === 'csv') {
            const csv = generateCSV(exportData, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=ride-requests-${Date.now()}.csv`);
            res.send(csv);
        } else {
            // Excel (default)
            const excelBuffer = await generateExcel(exportData, headers, `ride-requests-${Date.now()}.xlsx`, {
                title,
                sheetName: 'Ride Requests',
            });
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=ride-requests-${Date.now()}.xlsx`);
            res.send(excelBuffer);
        }
    } catch (error) {
        console.error("Export ride requests error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
