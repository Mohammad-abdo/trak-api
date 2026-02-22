import prisma from '../../utils/prisma.js';

// @desc    Get last user wallet operations
// @route   GET /apimobile/user/wallet/operations
// @access  Private
export const lastUserOperations = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20 } = req.query;

        const wallet = await prisma.wallet.findUnique({
            where: { userId },
            select: { id: true, balance: true, currency: true },
        });

        if (!wallet) {
            return res.json({ success: true, message: 'Wallet not found', data: { balance: 0, operations: [] } });
        }

        const operations = await prisma.walletHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            select: {
                id: true,
                type: true,
                amount: true,
                balance: true,
                description: true,
                transactionType: true,
                rideRequestId: true,
                createdAt: true,
            },
        });

        const total = await prisma.walletHistory.count({ where: { userId } });

        return res.json({
            success: true,
            message: 'Wallet operations retrieved',
            data: {
                wallet: { balance: wallet.balance, currency: wallet.currency },
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                operations,
            },
        });
    } catch (error) {
        console.error('Last user operations error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get wallet operations' });
    }
};

// @desc    Filter wallet operations by type
// @route   GET /apimobile/user/wallet/operations/filter
// @access  Private
export const filterOperations = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, transactionType } = req.query;

        const where = { userId };
        if (type) where.type = type;
        if (transactionType) where.transactionType = transactionType;

        const operations = await prisma.walletHistory.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                type: true,
                amount: true,
                balance: true,
                description: true,
                transactionType: true,
                rideRequestId: true,
                createdAt: true,
            },
        });

        return res.json({ success: true, message: 'Filtered operations retrieved', data: operations });
    } catch (error) {
        console.error('Filter operations error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to filter operations' });
    }
};
