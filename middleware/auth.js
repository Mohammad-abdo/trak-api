import jwt from "jsonwebtoken";
import prisma from "../utils/prisma.js";

const getTokenFromRequest = (req) => {
    const fromHeader = req.header("Authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (fromHeader) return fromHeader;
    const fromBody = req.body?.token;
    if (typeof fromBody === "string" && fromBody.trim()) return fromBody.trim();
    return null;
};

const verifyTokenAndLoadUser = async (token) => {
    const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your_jwt_secret_key_here"
    );
    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            contactNumber: true,
            userType: true,
            status: true,
            isOnline: true,
            isAvailable: true,
            serviceId: true,
            fleetId: true,
        },
    });
    return user;
};

export const authenticate = async (req, res, next) => {
    try {
        const token = getTokenFromRequest(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "No token provided, authorization denied",
            });
        }

        const user = await verifyTokenAndLoadUser(token);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Token is not valid",
        });
    }
};

/** Optional auth: sets req.user when valid token is present, otherwise continues without req.user (no 401). */
export const authenticateOptional = async (req, res, next) => {
    try {
        const token = req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            return next();
        }
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || "your_jwt_secret_key_here"
        );
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                contactNumber: true,
                userType: true,
                status: true,
                isOnline: true,
                isAvailable: true,
                serviceId: true,
                fleetId: true,
            },
        });
        if (user) req.user = user;
        next();
    } catch {
        next();
    }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions'
      });
    }

    next();
  };
};

