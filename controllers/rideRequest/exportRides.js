import prisma from "../../utils/prisma.js";
import { generateExcel, generatePDF, generateCSV, formatDate, formatCurrency } from "../../utils/exportUtils.js";

// @desc    Export ride requests
// @route   GET /api/ride-requests/export
// @access  Private (Admin)
export const exportRideRequests = async (req, res) => {
    try {
        const { status, from_date, to_date, format = "excel" } = req.query;

        const where = {};
        if (status) where.status = status;
        if (from_date) where.createdAt = { gte: new Date(from_date) };
        if (to_date) where.createdAt = { ...where.createdAt, lte: new Date(to_date) };

        const rideRequests = await prisma.rideRequest.findMany({
            where,
            include: {
                rider: { select: { firstName: true, lastName: true, email: true } },
                driver: { select: { firstName: true, lastName: true, email: true } },
                payments: { select: { amount: true, paymentMethod: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        const exportData = rideRequests.map((ride) => ({
            "Ride ID": ride.id,
            Date: formatDate(ride.createdAt),
            Rider: ride.rider ? `${ride.rider.firstName || ""} ${ride.rider.lastName || ""}`.trim() : "N/A",
            "Rider Email": ride.rider?.email || "",
            Driver: ride.driver ? `${ride.driver.firstName || ""} ${ride.driver.lastName || ""}`.trim() : "N/A",
            "Driver Email": ride.driver?.email || "",
            "Start Address": ride.startAddress || "",
            "End Address": ride.endAddress || "",
            Amount: formatCurrency(ride.payments.reduce((sum, p) => sum + p.amount, 0) || 0),
            "Payment Method": ride.payments[0]?.paymentMethod || "N/A",
            Status: ride.status,
        }));

        const headers = [
            { key: "Ride ID", label: "Ride ID" },
            { key: "Date", label: "Date" },
            { key: "Rider", label: "Rider" },
            { key: "Rider Email", label: "Rider Email" },
            { key: "Driver", label: "Driver" },
            { key: "Driver Email", label: "Driver Email" },
            { key: "Start Address", label: "Start Address" },
            { key: "End Address", label: "End Address" },
            { key: "Amount", label: "Amount" },
            { key: "Payment Method", label: "Payment Method" },
            { key: "Status", label: "Status" },
        ];

        const title = "Ride Requests Report";

        if (format === "pdf") {
            const pdfBuffer = await generatePDF(exportData, headers, title);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename=ride-requests-${Date.now()}.pdf`);
            res.send(pdfBuffer);
        } else if (format === "csv") {
            const csv = generateCSV(exportData, headers);
            res.setHeader("Content-Type", "text/csv");
            res.setHeader("Content-Disposition", `attachment; filename=ride-requests-${Date.now()}.csv`);
            res.send(csv);
        } else {
            const excelBuffer = await generateExcel(exportData, headers, `ride-requests-${Date.now()}.xlsx`, {
                title,
                sheetName: "Ride Requests",
            });
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", `attachment; filename=ride-requests-${Date.now()}.xlsx`);
            res.send(excelBuffer);
        }
    } catch (error) {
        console.error("Export ride requests error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
