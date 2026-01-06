import prisma from "../utils/prisma.js";
import bcrypt from "bcryptjs";

// @desc    Get fleet list
// @route   GET /api/fleets
// @access  Private (Admin)
export const getFleetList = async (req, res) => {
    try {
        const { status, per_page = 10, page = 1 } = req.query;

        const where = {
            userType: "fleet",
        };

        if (status) {
            where.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(per_page);

        const [fleets, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: parseInt(per_page),
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    contactNumber: true,
                    status: true,
                    createdAt: true,
                    drivers: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            data: fleets,
            pagination: {
                total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                total_pages: Math.ceil(total / parseInt(per_page)),
            },
        });
    } catch (error) {
        console.error("Get fleet list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create fleet
// @route   POST /api/fleets
// @access  Private (Admin)
export const createFleet = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            contactNumber,
            address,
        } = req.body;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { contactNumber }],
            },
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User with this email or contact number already exists",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate username
        const username =
            email.split("@")[0] + Math.floor(Math.random() * 1000);

        const fleet = await prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                username,
                password: hashedPassword,
                contactNumber,
                address,
                userType: "fleet",
                displayName: `${firstName} ${lastName}`,
                status: "active",
            },
        });

        res.status(201).json({
            success: true,
            data: fleet,
            message: "Fleet created successfully",
        });
    } catch (error) {
        console.error("Create fleet error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update fleet
// @route   PUT /api/fleets/:id
// @access  Private (Admin)
export const updateFleet = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, contactNumber, address, status } =
            req.body;

        const fleet = await prisma.user.update({
            where: { id: parseInt(id), userType: "fleet" },
            data: {
                firstName,
                lastName,
                email,
                contactNumber,
                address,
                status,
                displayName: `${firstName} ${lastName}`,
            },
        });

        res.json({
            success: true,
            data: fleet,
            message: "Fleet updated successfully",
        });
    } catch (error) {
        console.error("Update fleet error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete fleet
// @route   DELETE /api/fleets/:id
// @access  Private (Admin)
export const deleteFleet = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.user.delete({
            where: { id: parseInt(id), userType: "fleet" },
        });

        res.json({
            success: true,
            message: "Fleet deleted successfully",
        });
    } catch (error) {
        console.error("Delete fleet error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get fleet detail
// @route   GET /api/fleets/:id
// @access  Private (Admin)
export const getFleetDetail = async (req, res) => {
    try {
        const { id } = req.params;

        const fleet = await prisma.user.findFirst({
            where: { id: parseInt(id), userType: "fleet" },
            include: {
                drivers: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        status: true,
                    },
                },
            },
        });

        if (!fleet) {
            return res.status(404).json({
                success: false,
                message: "Fleet not found",
            });
        }

        res.json({
            success: true,
            data: fleet,
        });
    } catch (error) {
        console.error("Get fleet detail error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



