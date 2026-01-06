import prisma from "../utils/prisma.js";

// @desc    Get reference list (users who used referral code)
// @route   GET /api/references/reference-list
// @access  Private
export const getReferenceList = async (req, res) => {
    try {
        let where = {};

        if (req.user.userType === "admin") {
            where = {
                partnerReferralCode: {
                    not: null,
                },
            };
        } else {
            if (!req.user.referralCode) {
                return res.json({
                    success: false,
                    message: "Your referral code not found",
                });
            }

            where = {
                partnerReferralCode: req.user.referralCode,
            };
        }

        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
                userType: true,
                referralCode: true,
                partnerReferralCode: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        // Format as references with referrer and referred user info
        const references = users.map((user) => {
            return {
                id: user.id,
                referrerUserId: null, // Will be set if we can find the referrer
                referredUserId: user.id,
                referralCode: user.partnerReferralCode,
                referrerUser: null, // Can be populated if needed
                referredUser: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                },
                createdAt: user.createdAt,
            };
        });

        if (references.length === 0) {
            return res.json({
                success: false,
                message: "No one has used your referral code yet",
            });
        }

        res.json({
            success: true,
            data: references.length > 0 ? references : [],
        });
    } catch (error) {
        console.error("Get reference list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

