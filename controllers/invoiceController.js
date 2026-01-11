import prisma from "../utils/prisma.js";
import PDFDocument from "pdfkit";
import { formatCurrency, formatDate } from "../utils/exportUtils.js";

/**
 * Generate ride invoice PDF
 * @route   GET /api/invoices/ride/:id
 * @access  Private
 */
export const generateRideInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const rideRequest = await prisma.rideRequest.findUnique({
            where: { id: parseInt(id) },
            include: {
                rider: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        contactNumber: true,
                    },
                },
                driver: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        contactNumber: true,
                    },
                },
                service: {
                    select: {
                        id: true,
                        name: true,
                        adminCommission: true,
                        fleetCommission: true,
                        commissionType: true,
                    },
                },
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        paymentType: true,
                        paymentStatus: true,
                        paymentDate: true,
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

        // Generate PDF
        const pdfBuffer = await generateInvoicePDF(rideRequest);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=invoice_${rideRequest.id}.pdf`
        );
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Generate invoice error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

/**
 * Generate invoice PDF
 */
const generateInvoicePDF = (rideRequest) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: "A4", margin: 50 });
            const buffers = [];

            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => {
                const pdfBuffer = Buffer.concat(buffers);
                resolve(pdfBuffer);
            });
            doc.on("error", reject);

            const payment = rideRequest.payments?.[0] || {};
            const today = new Date();

            // Header
            doc.fontSize(24).text("INVOICE", { align: "center" });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`Invoice #${rideRequest.id}`, { align: "center" });
            doc.moveDown();

            // Company/App Info (you can customize this)
            doc.fontSize(10).text("Tovo", { align: "left" });
            doc.text("Taxi Service", { align: "left" });
            doc.moveDown();

            // Invoice Details
            const startY = doc.y;
            doc.fontSize(10);
            doc.text(`Invoice Date: ${formatDate(today)}`, 50, startY);
            doc.text(`Ride Date: ${formatDate(rideRequest.createdAt)}`, 50, startY + 15);
            doc.text(`Status: ${rideRequest.status}`, 50, startY + 30);

            // Customer Info
            const customerY = startY;
            doc.text("Bill To:", 350, customerY);
            doc.text(
                `${rideRequest.rider?.firstName || ""} ${rideRequest.rider?.lastName || ""}`,
                350,
                customerY + 15
            );
            doc.text(rideRequest.rider?.email || "-", 350, customerY + 30);
            doc.text(rideRequest.rider?.contactNumber || "-", 350, customerY + 45);

            doc.moveDown(3);

            // Ride Details
            doc.fontSize(14).text("Ride Details", { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);

            const detailsY = doc.y;
            doc.text(`Service: ${rideRequest.service?.name || "N/A"}`, 50, detailsY);
            doc.text(
                `Driver: ${rideRequest.driver?.firstName || ""} ${rideRequest.driver?.lastName || ""}`,
                50,
                detailsY + 15
            );
            doc.text(
                `Pickup: ${rideRequest.startAddress || "N/A"}`,
                50,
                detailsY + 30
            );
            doc.text(
                `Drop: ${rideRequest.endAddress || "N/A"}`,
                50,
                detailsY + 45
            );

            if (rideRequest.distance) {
                doc.text(`Distance: ${rideRequest.distance} km`, 50, detailsY + 60);
            }
            if (rideRequest.duration) {
                doc.text(`Duration: ${rideRequest.duration} min`, 50, detailsY + 75);
            }

            doc.moveDown(4);

            // Payment Breakdown
            doc.fontSize(14).text("Payment Breakdown", { underline: true });
            doc.moveDown(0.5);

            const tableTop = doc.y;
            const itemHeight = 20;
            let currentY = tableTop;

            // Table Header
            doc.rect(50, currentY, 500, itemHeight).fill("#4472C4");
            doc.fontSize(10)
                .fillColor("white")
                .text("Description", 55, currentY + 5)
                .text("Amount", 450, currentY + 5, { align: "right" });

            currentY += itemHeight;

            // Base Fare - Use ride request total amount
            const totalAmount = rideRequest.totalAmount || payment.amount || 0;
            if (totalAmount) {
                // Calculate admin commission if service has commission
                let adminCommission = 0;
                if (rideRequest.service?.adminCommission) {
                    if (rideRequest.service.commissionType === "percentage") {
                        adminCommission = (totalAmount * rideRequest.service.adminCommission) / 100;
                    } else {
                        adminCommission = rideRequest.service.adminCommission;
                    }
                }
                
                const baseFare = totalAmount - adminCommission;
                doc.rect(50, currentY, 500, itemHeight).fill("#F2F2F2");
                doc.fontSize(10)
                    .fillColor("black")
                    .text("Base Fare", 55, currentY + 5)
                    .text(formatCurrency(baseFare), 450, currentY + 5, { align: "right" });
                currentY += itemHeight;
            }

            // Admin Commission
            if (rideRequest.service?.adminCommission) {
                let adminCommission = 0;
                if (rideRequest.service.commissionType === "percentage") {
                    adminCommission = ((rideRequest.totalAmount || payment.amount || 0) * rideRequest.service.adminCommission) / 100;
                } else {
                    adminCommission = rideRequest.service.adminCommission;
                }
                
                if (adminCommission > 0) {
                    doc.rect(50, currentY, 500, itemHeight).fill("white");
                    doc.fontSize(10)
                        .fillColor("black")
                        .text("Service Fee", 55, currentY + 5)
                        .text(formatCurrency(adminCommission), 450, currentY + 5, {
                            align: "right",
                        });
                    currentY += itemHeight;
                }
            }

            // Total
            currentY += 5;
            doc.rect(50, currentY, 500, itemHeight).fill("#E8E8E8");
            doc.fontSize(12)
                .font("Helvetica-Bold")
                .fillColor("black")
                .text("Total", 55, currentY + 5)
                .text(formatCurrency(totalAmount), 450, currentY + 5, {
                    align: "right",
                });

            // Payment Info
            doc.moveDown(2);
            doc.fontSize(10);
            doc.text(`Payment Method: ${payment.paymentType || "N/A"}`);
            doc.text(`Payment Status: ${payment.paymentStatus || "N/A"}`);

            // Footer
            doc.fontSize(8)
                .fillColor("gray")
                .text("Thank you for using our service!", 50, doc.page.height - 50, {
                    align: "center",
                    width: 500,
                });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

