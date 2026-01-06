import prisma from "../utils/prisma.js";

// @desc    Get payment gateway list
// @route   GET /api/payment-gateways/payment-gateway-list
// @access  Private
export const getPaymentGatewayList = async (req, res) => {
    try {
        const gateways = await prisma.paymentGateway.findMany({
            where: {
                status: 1,
            },
            orderBy: { createdAt: "asc" },
        });

        res.json({
            success: true,
            data: gateways,
        });
    } catch (error) {
        console.error("Get payment gateway list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



