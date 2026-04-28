/**
 * Reusable Prisma `select` objects to avoid duplication across controllers.
 */

export const fullUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    displayName: true,
    email: true,
    contactNumber: true,
    countryCode: true,
    userType: true,
    loginType: true,
    status: true,
    avatar: true,
    gender: true,
    address: true,
    latitude: true,
    longitude: true,
    isOnline: true,
    isAvailable: true,
    referralCode: true,
    isVerified: true,
    createdAt: true,
};

export const fullUserWithDetailsSelect = {
    ...fullUserSelect,
    userDetail: {
        select: {
            carModel: true,
            carColor: true,
            carPlateNumber: true,
            homeAddress: true,
            workAddress: true,
        },
    },
    wallet: { select: { balance: true, currency: true } },
};
