import bcrypt from "bcryptjs";
import prisma from "../../utils/prisma.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/serverResponse.js";
import { generateToken } from "../../utils/jwtHelper.js";
import { fullUserSelect } from "../../utils/prismaSelects.js";
import { contactNumberLookupVariants } from "../../utils/phoneLookup.js";

export const login = asyncHandler(async (req, res) => {
    const { phone, password } = req.body;
    if (!phone || !password) {
        return errorResponse(res, "Phone and password are required", 400);
    }

    const variants = contactNumberLookupVariants(phone);
    if (variants.length === 0) {
        return errorResponse(res, "Invalid phone or password", 401);
    }

    const matches = await prisma.user.findMany({
        where: { contactNumber: { in: variants } },
        take: 20,
    });
    const user =
        matches.find((u) => String(u.userType || "").toLowerCase() === "driver") || null;
    if (!user) {
        return errorResponse(res, "Invalid phone or password", 401);
    }
    if (!user.password) {
        return errorResponse(res, "Password not set for this account", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return errorResponse(res, "Invalid phone or password", 401);
    }

    const blockedStatuses = ["inactive", "banned", "deleted", "suspended"];
    if (blockedStatuses.includes(user.status)) {
        return errorResponse(res, `Account is ${user.status}. Contact support.`, 403);
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { lastActivedAt: new Date(), isOnline: true },
    });

    const token = generateToken(user.id);
    const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: fullUserSelect,
    });

    const ratingsAgg = await prisma.rideRequestRating.aggregate({
        where: { driverId: user.id },
        _avg: { rating: true },
        _count: { rating: true },
    });

    const totalEarnings = await prisma.walletHistory.aggregate({
        where: { userId: user.id, type: "credit" },
        _sum: { amount: true },
    });

    const responseData = {
        token,
        user: fullUser,
        stats: {
            averageRating: ratingsAgg._avg.rating || 0,
            totalRatings: ratingsAgg._count.rating || 0,
            totalEarnings: totalEarnings._sum.amount || 0,
        },
    };

    return successResponse(res, responseData, "Login successful");
});
