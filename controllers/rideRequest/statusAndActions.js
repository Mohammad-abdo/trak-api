import prisma from "../../utils/prisma.js";
import { getDriverAndSystemShare } from "../../utils/settingsHelper.js";

// @desc    Update ride request
// @route   POST /api/ride-requests/riderequest-update/:id
export const updateRideRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const rideRequest = await prisma.rideRequest.update({ where: { id: parseInt(id) }, data: req.body });
        res.json({ success: true, message: "Ride request updated successfully", data: rideRequest });
    } catch (error) {
        console.error("Update ride request error:", error);
        if (error.code === "P2025") return res.status(404).json({ success: false, message: "Ride request not found" });
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete ride request
// @route   POST /api/ride-requests/riderequest-delete/:id
export const deleteRideRequest = async (req, res) => {
    try {
        await prisma.rideRequest.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ success: true, message: "Ride request deleted successfully" });
    } catch (error) {
        console.error("Delete ride request error:", error);
        if (error.code === "P2025") return res.status(404).json({ success: false, message: "Ride request not found" });
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Accept / reject ride request
// @route   POST /api/ride-requests/riderequest-respond
export const acceptRideRequest = async (req, res) => {
    try {
        const { rideRequestId, accept } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideRequestId } });
        if (!rideRequest) return res.status(404).json({ success: false, message: "Ride request not found" });

        if (accept) {
            await prisma.rideRequest.update({ where: { id: rideRequestId }, data: { driverId: req.user.id, status: "accepted" } });
        } else {
            const cancelledIds = rideRequest.cancelledDriverIds ? JSON.parse(rideRequest.cancelledDriverIds) : [];
            cancelledIds.push(req.user.id);
            await prisma.rideRequest.update({ where: { id: rideRequestId }, data: { cancelledDriverIds: JSON.stringify(cancelledIds) } });
        }

        const updatedRideRequest = await prisma.rideRequest.findUnique({ where: { id: rideRequestId } });
        res.json({ success: true, message: accept ? "Ride request accepted" : "Ride request rejected", data: updatedRideRequest });
    } catch (error) {
        console.error("Accept ride request error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Complete ride request
// @route   POST /api/ride-requests/complete-riderequest
export const completeRideRequest = async (req, res) => {
    try {
        const { rideRequestId, tips } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: rideRequestId } });
        if (!rideRequest) return res.status(404).json({ success: false, message: "Ride request not found" });
        if (rideRequest.driverId !== req.user.id) return res.status(403).json({ success: false, message: "Not authorized to complete this ride" });

        const effectiveFare =
            rideRequest.negotiationStatus === "accepted" && rideRequest.negotiatedFare != null
                ? parseFloat(rideRequest.negotiatedFare)
                : parseFloat(rideRequest.totalAmount);
        const totalAmount = effectiveFare + (parseFloat(tips) || 0);

        await prisma.rideRequest.update({ where: { id: rideRequestId }, data: { status: "completed", tips: tips || 0, totalAmount } });

        await prisma.payment.create({
            data: {
                rideRequestId: rideRequest.id,
                userId: rideRequest.riderId,
                driverId: rideRequest.driverId,
                amount: totalAmount,
                paymentType: rideRequest.paymentType,
                paymentStatus: rideRequest.paymentType === "cash" ? "paid" : "pending",
            },
        });

        if (rideRequest.paymentType === "cash" && rideRequest.driverId && totalAmount > 0) {
            const totalNum = Number(totalAmount);
            const { driverShare } = await getDriverAndSystemShare(totalNum);
            let driverWallet = await prisma.wallet.findUnique({ where: { userId: rideRequest.driverId } });
            if (!driverWallet) {
                driverWallet = await prisma.wallet.create({ data: { userId: rideRequest.driverId, balance: 0 } });
            }
            const currentBalance = parseFloat(driverWallet.balance) || 0;
            const amountToAdd = driverShare > 0 ? driverShare : 0;
            const newDriverBalance = Math.round((currentBalance + amountToAdd) * 100) / 100;
            await prisma.wallet.update({ where: { id: driverWallet.id }, data: { balance: newDriverBalance } });
            await prisma.walletHistory.create({
                data: {
                    walletId: driverWallet.id,
                    userId: rideRequest.driverId,
                    type: "credit",
                    amount: totalNum,
                    balance: newDriverBalance,
                    description: rideRequest.negotiationStatus === "accepted" ? "Ride earnings (cash) — negotiated fare" : "Ride earnings (cash)",
                    transactionType: "ride_earnings",
                    rideRequestId: rideRequest.id,
                },
            });
        }

        const updatedRideRequest = await prisma.rideRequest.findUnique({ where: { id: rideRequestId } });
        res.json({ success: true, message: "Ride completed successfully", data: updatedRideRequest });
    } catch (error) {
        console.error("Complete ride request error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update drop location
// @route   POST /api/ride-requests/riderequest/:id/drop/:index
export const updateDropLocation = async (req, res) => {
    try {
        const { id, index } = req.params;
        const { latitude, longitude, address } = req.body;

        const rideRequest = await prisma.rideRequest.findUnique({ where: { id: parseInt(id) } });
        if (!rideRequest) return res.status(404).json({ success: false, message: "Ride request not found" });

        let dropLocations = rideRequest.dropLocation ? JSON.parse(JSON.stringify(rideRequest.dropLocation)) : [];

        if (Array.isArray(dropLocations)) {
            const dropIndex = parseInt(index);
            if (dropIndex >= 0 && dropIndex < dropLocations.length) {
                dropLocations[dropIndex] = { latitude: parseFloat(latitude), longitude: parseFloat(longitude), address };
            } else {
                dropLocations.push({ latitude: parseFloat(latitude), longitude: parseFloat(longitude), address });
            }
        } else {
            dropLocations = [{ latitude: parseFloat(latitude), longitude: parseFloat(longitude), address }];
        }

        const updatedRideRequest = await prisma.rideRequest.update({
            where: { id: parseInt(id) },
            data: { dropLocation: JSON.parse(JSON.stringify(dropLocations)) },
        });

        res.json({ success: true, message: "Drop location updated successfully", data: updatedRideRequest });
    } catch (error) {
        console.error("Update drop location error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
