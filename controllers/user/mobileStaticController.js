import prisma from '../../utils/prisma.js';

// @desc    Get Privacy Policy page
// @route   GET /apimobile/user/static/privacy-policy
// @access  Private
export const getPrivacyPolicy = async (req, res) => {
    try {
        const page = await prisma.pages.findFirst({
            where: { slug: 'privacy-policy', status: 1 },
            select: { id: true, title: true, titleAr: true, description: true, descriptionAr: true, slug: true },
        });

        return res.json({
            success: true,
            message: 'Privacy policy retrieved',
            data: page ?? { title: 'Privacy Policy', description: 'No content available yet.' },
        });
    } catch (error) {
        console.error('Privacy policy error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get privacy policy' });
    }
};

// @desc    Help Center / FAQs
// @route   GET /apimobile/user/static/help-center
// @access  Private
export const getHelpCenter = async (req, res) => {
    try {
        const faqs = await prisma.faq.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                question: true,
                questionAr: true,
                answer: true,
                answerAr: true,
                type: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        return res.json({ success: true, message: 'Help center retrieved', data: faqs });
    } catch (error) {
        console.error('Help center error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get help center' });
    }
};

// @desc    Get Terms and Conditions page
// @route   GET /apimobile/user/static/terms
// @access  Private
export const getTerms = async (req, res) => {
    try {
        const page = await prisma.pages.findFirst({
            where: { slug: 'terms-and-conditions', status: 1 },
            select: { id: true, title: true, titleAr: true, description: true, descriptionAr: true },
        });

        return res.json({
            success: true,
            message: 'Terms retrieved',
            data: page ?? { title: 'Terms & Conditions', description: 'No content available yet.' },
        });
    } catch (error) {
        console.error('Terms error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get terms' });
    }
};

// @desc    Get all notifications for the current user
// @route   GET /apimobile/user/notifications
// @access  Private
export const getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 30 } = req.query;

        const notifications = await prisma.notification.findMany({
            where: {
                notifiableType: 'user',
                notifiableId: userId,
            },
            orderBy: { createdAt: 'desc' },
            skip: (parseInt(page) - 1) * parseInt(limit),
            take: parseInt(limit),
            select: {
                id: true,
                type: true,
                data: true,
                isRead: true,
                readAt: true,
                createdAt: true,
            },
        });

        const total = await prisma.notification.count({
            where: { notifiableType: 'user', notifiableId: userId },
        });

        const unreadCount = await prisma.notification.count({
            where: { notifiableType: 'user', notifiableId: userId, isRead: false },
        });

        // Also get active offers/coupons to display in notifications screen
        const now = new Date();
        const offers = await prisma.coupon.findMany({
            where: {
                status: 1,
                OR: [{ endDate: null }, { endDate: { gte: now } }],
            },
            select: { id: true, title: true, code: true, discountType: true, discount: true, endDate: true },
            take: 5,
            orderBy: { createdAt: 'desc' },
        });

        // Mark all as read
        await prisma.notification.updateMany({
            where: { notifiableType: 'user', notifiableId: userId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });

        return res.json({
            success: true,
            message: 'Notifications retrieved',
            data: {
                total,
                unreadCount,
                page: parseInt(page),
                limit: parseInt(limit),
                notifications,
                activeOffers: offers,
            },
        });
    } catch (error) {
        console.error('Notifications error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get notifications' });
    }
};
