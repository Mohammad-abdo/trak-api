import Prisma from '@prisma/client';
const { PrismaClient } = Prisma;
const prisma = new PrismaClient();

/**
 * Calculate distance between two coordinates in km
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        return dist * 1.609344;
    }
};

/**
 * Calculate dynamic price based on vehicle category rules
 * @param {number} vehicleCategoryId 
 * @param {number} distanceInKm 
 * @param {number} durationInMin 
 * @param {number} waitTimeInMin 
 * @returns {Promise<Object>} Price breakdown
 */
export const calculateTripPrice = async (vehicleCategoryId, distanceInKm, durationInMin = 0, waitTimeInMin = 0) => {
    try {
        // 1. Get pricing rules for the category
        // We look for the active rule for this category
        const rules = await prisma.pricingRule.findFirst({
            where: {
                vehicleCategoryId: parseInt(vehicleCategoryId),
                status: 1
            },
            include: {
                vehicleCategory: true
            }
        });

        if (!rules) {
            throw new Error('No pricing rules found for this vehicle category');
        }

        // 2. Initialize price components
        let baseFare = rules.baseFare;
        let distanceCharge = 0;
        let timeCharge = 0;
        let waitingCharge = 0;
        const baseDistance = rules.baseDistance || 5.0; // Default 5km

        // 3. Calculate Distance Charge
        // Rule: Base fare covers up to baseDistance (e.g., 5km)
        // Extra charge applies only to distance BEYOND baseDistance
        if (distanceInKm > baseDistance) {
            const extraDistance = distanceInKm - baseDistance;
            distanceCharge = extraDistance * rules.perDistanceAfterBase;
        }

        // 4. Calculate Time Charge (if applicable)
        if (rules.perMinuteDrive > 0 && durationInMin > 0) {
            timeCharge = durationInMin * rules.perMinuteDrive;
        }

        // 5. Calculate Waiting Charge (if applicable)
        // Only charge for waiting time exceeding the limit (if any)
        const freeWaitTime = rules.waitingTimeLimit || 0;
        if (rules.perMinuteWait > 0 && waitTimeInMin > freeWaitTime) {
            const chargeableWaitTime = waitTimeInMin - freeWaitTime;
            waitingCharge = chargeableWaitTime * rules.perMinuteWait;
        }

        // 6. Calculate Subtotal
        let totalAmount = baseFare + distanceCharge + timeCharge + waitingCharge;

        // 7. Enforce Minimum Fare
        if (totalAmount < rules.minimumFare) {
            totalAmount = rules.minimumFare;
        }

        // 8. Prepare detailed breakdown
        return {
            success: true,
            currency: "SAR",
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            breakdown: {
                baseFare: parseFloat(baseFare.toFixed(2)),
                baseDistance: parseFloat(baseDistance.toFixed(2)),
                distance: parseFloat(distanceInKm.toFixed(2)),
                extraDistance: parseFloat(Math.max(0, distanceInKm - baseDistance).toFixed(2)),
                perKmRate: parseFloat(rules.perDistanceAfterBase.toFixed(2)),
                distanceCharge: parseFloat(distanceCharge.toFixed(2)),
                timeCharge: parseFloat(timeCharge.toFixed(2)),
                waitingCharge: parseFloat(waitingCharge.toFixed(2)),
                minimumFare: parseFloat(rules.minimumFare.toFixed(2)),
                appliedMessage: totalAmount === rules.minimumFare ? "Minimum fare applied" : "Standard calculation"
            },
            vehicleCategory: rules.vehicleCategory
        };

    } catch (error) {
        console.error('Price Calculation Error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};
