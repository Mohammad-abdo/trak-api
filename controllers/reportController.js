import prisma from "../utils/prisma.js";
import { generateExcel, generatePDF, generateCSV, formatCurrency, formatDate } from "../utils/exportUtils.js";

// @desc    Get admin earning report
// @route   GET /api/reports/admin-earning
// @access  Private (Admin)
export const adminEarning = async (req, res) => {
    try {
        const { from_date, to_date, rider_id, driver_id } = req.query;

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
        if (rider_id) {
            where.riderId = parseInt(rider_id);
        }
        if (driver_id) {
            where.driverId = parseInt(driver_id);
        }

        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                payments: {
                    select: {
                        amount: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Calculate totals
        const totals = await prisma.payment.aggregate({
            where: {
                rideRequest: {
                    status: "completed",
                    ...(from_date && { createdAt: { gte: new Date(from_date) } }),
                    ...(to_date && { createdAt: { lte: new Date(to_date) } }),
                    ...(rider_id && { riderId: parseInt(rider_id) }),
                    ...(driver_id && { driverId: parseInt(driver_id) }),
                },
            },
            _sum: {
                amount: true,
            },
        });

        res.json({
            success: true,
            data: {
                rideRequests,
                totals: {
                    totalAmount: totals._sum.amount || 0,
                },
            },
        });
    } catch (error) {
        console.error("Admin earning report error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get driver earning report
// @route   GET /api/reports/driver-earning
// @access  Private (Admin)
export const driverEarning = async (req, res) => {
    try {
        const { from_date, to_date, driver_id } = req.query;

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
        if (driver_id) {
            where.driverId = parseInt(driver_id);
        }

        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                payments: {
                    select: {
                        amount: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const totals = await prisma.payment.aggregate({
            where: {
                rideRequest: {
                    status: "completed",
                    ...(from_date && { createdAt: { gte: new Date(from_date) } }),
                    ...(to_date && { createdAt: { lte: new Date(to_date) } }),
                    ...(driver_id && { driverId: parseInt(driver_id) }),
                },
            },
            _sum: {
                amount: true,
            },
        });

        res.json({
            success: true,
            data: {
                rideRequests,
                totals: {
                    totalAmount: totals._sum.amount || 0,
                },
            },
        });
    } catch (error) {
        console.error("Driver earning report error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get service-wise report
// @route   GET /api/reports/service-wise
// @access  Private (Admin)
export const serviceWiseReport = async (req, res) => {
    try {
        const { from_date, to_date, service_id } = req.query;

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
        if (service_id) {
            where.serviceId = parseInt(service_id);
        }

        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
                service: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                payments: {
                    select: {
                        amount: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Group by service
        const serviceStats = {};
        rideRequests.forEach((ride) => {
            const serviceName = ride.service?.name || "Unknown";
            if (!serviceStats[serviceName]) {
                serviceStats[serviceName] = {
                    serviceName,
                    totalRides: 0,
                    totalAmount: 0,
                };
            }
            serviceStats[serviceName].totalRides++;
            serviceStats[serviceName].totalAmount +=
                ride.payments.reduce((sum, p) => sum + p.amount, 0) || 0;
        });

        res.json({
            success: true,
            data: {
                rideRequests,
                serviceStats: Object.values(serviceStats),
            },
        });
    } catch (error) {
        console.error("Service-wise report error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get driver report
// @route   GET /api/reports/driver-report
// @access  Private (Admin)
export const driverReport = async (req, res) => {
    try {
        const { status, from_date, to_date } = req.query;

        const where = {
            userType: "driver",
        };

        if (status) {
            where.status = status;
        }

        const drivers = await prisma.user.findMany({
            where,
            include: {
                driverRideRequests: {
                    where: {
                        ...(from_date && { createdAt: { gte: new Date(from_date) } }),
                        ...(to_date && { createdAt: { lte: new Date(to_date) } }),
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json({
            success: true,
            data: drivers,
        });
    } catch (error) {
        console.error("Driver report error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Export admin earning report
// @route   GET /api/reports/admin-earning/export
// @access  Private (Admin)
export const exportAdminEarning = async (req, res) => {
    try {
        const { from_date, to_date, rider_id, driver_id, format = 'excel' } = req.query;

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
        if (rider_id) {
            where.riderId = parseInt(rider_id);
        }
        if (driver_id) {
            where.driverId = parseInt(driver_id);
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
            'Rider': `${ride.rider?.firstName || ''} ${ride.rider?.lastName || ''}`.trim(),
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

        const dateFilter = from_date || to_date 
            ? `From: ${from_date || 'N/A'} To: ${to_date || 'N/A'}`
            : null;

        if (format === 'pdf') {
            const pdfBuffer = await generatePDF(
                exportData,
                headers,
                'Admin Earning Report',
                { dateFilter }
            );
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=admin-earning-${Date.now()}.pdf`);
            res.send(pdfBuffer);
        } else if (format === 'csv') {
            const csv = generateCSV(exportData, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=admin-earning-${Date.now()}.csv`);
            res.send(csv);
        } else {
            // Excel (default)
            const excelBuffer = await generateExcel(
                exportData,
                headers,
                `admin-earning-${Date.now()}.xlsx`,
                {
                    title: 'Admin Earning Report',
                    sheetName: 'Admin Earnings',
                }
            );
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=admin-earning-${Date.now()}.xlsx`);
            res.send(excelBuffer);
        }
    } catch (error) {
        console.error("Export admin earning error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Export driver earning report
// @route   GET /api/reports/driver-earning/export
// @access  Private (Admin)
export const exportDriverEarning = async (req, res) => {
    try {
        const { from_date, to_date, driver_id, format = 'excel' } = req.query;

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
        if (driver_id) {
            where.driverId = parseInt(driver_id);
        }

        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
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
            { key: 'Driver', label: 'Driver' },
            { key: 'Driver Email', label: 'Driver Email' },
            { key: 'Start Address', label: 'Start Address' },
            { key: 'End Address', label: 'End Address' },
            { key: 'Amount', label: 'Amount' },
            { key: 'Payment Method', label: 'Payment Method' },
            { key: 'Status', label: 'Status' },
        ];

        const dateFilter = from_date || to_date 
            ? `From: ${from_date || 'N/A'} To: ${to_date || 'N/A'}`
            : null;

        if (format === 'pdf') {
            const pdfBuffer = await generatePDF(
                exportData,
                headers,
                'Driver Earning Report',
                { dateFilter }
            );
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=driver-earning-${Date.now()}.pdf`);
            res.send(pdfBuffer);
        } else if (format === 'csv') {
            const csv = generateCSV(exportData, headers);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=driver-earning-${Date.now()}.csv`);
            res.send(csv);
        } else {
            // Excel (default)
            const excelBuffer = await generateExcel(
                exportData,
                headers,
                `driver-earning-${Date.now()}.xlsx`,
                {
                    title: 'Driver Earning Report',
                    sheetName: 'Driver Earnings',
                }
            );
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=driver-earning-${Date.now()}.xlsx`);
            res.send(excelBuffer);
        }
    } catch (error) {
        console.error("Export driver earning error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



