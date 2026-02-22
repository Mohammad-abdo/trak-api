import prisma from '../../utils/prisma.js';

// @desc    Get all services (ServiceCategory list)
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

        return res.json({ success: true, message: 'Services retrieved', data: categories });
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

        return res.json({ success: true, message: 'Service selected', data: category });
    } catch (error) {
        console.error('Choose service error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to choose service' });
    }
};
