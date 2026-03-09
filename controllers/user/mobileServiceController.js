import prisma from '../../utils/prisma.js';
import { fullImageUrl } from '../../utils/imageUrl.js';

const SERVICE_CATEGORY_IMAGES = {
    'passenger-transport': 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800',
    'cargo-transport': 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800',
    'additional-services': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
};

// @desc    Get all services (ServiceCategory list) — same shape as home/services
// @route   GET /apimobile/user/services/all
// @access  Private
export const getAllServices = async (req, res) => {
    try {
        const categories = await prisma.serviceCategory.findMany({
            where: { status: 1 },
            select: {
                id: true,
                name: true,
                nameAr: true,
                icon: true,
                slug: true,
                description: true,
                vehicleCategories: {
                    where: { status: 1 },
                    select: { id: true, name: true, nameAr: true, image: true, icon: true },
                },
            },
        });

        const data = categories.map(cat => ({
            ...cat,
            image: SERVICE_CATEGORY_IMAGES[cat.slug] ?? null,
            vehicleCategories: cat.vehicleCategories.map(vc => ({
                ...vc,
                image: fullImageUrl(req, vc.image),
            })),
        }));

        return res.json({ success: true, message: 'Services retrieved', data });
    } catch (error) {
        console.error('Get all services error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to get services' });
    }
};

// @desc    Choose a service → return service details for Booking screen
// @route   GET /apimobile/user/services/choose/:serviceId
// @access  Private
export const chooseService = async (req, res) => {
    try {
        const { serviceId } = req.params;

        const category = await prisma.serviceCategory.findUnique({
            where: { id: parseInt(serviceId) },
            select: {
                id: true,
                name: true,
                nameAr: true,
                icon: true,
                description: true,
                vehicleCategories: {
                    where: { status: 1 },
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        image: true,
                        icon: true,
                        capacity: true,
                        maxLoad: true,
                        pricingRules: {
                            where: { status: 1 },
                            select: {
                                id: true,
                                baseFare: true,
                                minimumFare: true,
                                baseDistance: true,
                                perDistanceAfterBase: true,
                                perMinuteDrive: true,
                            },
                            take: 1,
                        },
                    },
                },
            },
        });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        const data = {
            ...category,
            vehicleCategories: category.vehicleCategories.map(vc => ({
                ...vc,
                image: fullImageUrl(req, vc.image),
            })),
        };

        return res.json({ success: true, message: 'Service selected', data });
    } catch (error) {
        console.error('Choose service error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to choose service' });
    }
};
