import prisma from "../utils/prisma.js";

// @desc    Get SMS template list
// @route   GET /api/ride-sms
// @access  Private (Admin)
export const getRideSMSList = async (req, res) => {
    try {
        const { type, ride_status } = req.query;

        const where = {};
        if (type) {
            where.type = type;
        }
        if (ride_status) {
            where.rideStatus = ride_status;
        }

        const templates = await prisma.sMSTemplatRide.findMany({
            where,
            include: {
                smsSetting: true,
            },
            orderBy: { type: "asc" },
        });

        res.json({
            success: true,
            data: templates,
        });
    } catch (error) {
        console.error("Get ride SMS list error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get SMS template by type
// @route   GET /api/ride-sms/:type
// @access  Private (Admin)
export const getRideSMSByType = async (req, res) => {
    try {
        const { type } = req.params;

        const template = await prisma.sMSTemplatRide.findFirst({
            where: { type },
            include: {
                smsSetting: true,
            },
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: "SMS template not found",
            });
        }

        res.json({
            success: true,
            data: template,
        });
    } catch (error) {
        console.error("Get ride SMS by type error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Create or update SMS template
// @route   POST /api/ride-sms
// @access  Private (Admin)
export const saveRideSMS = async (req, res) => {
    try {
        const { type, subject, sms_description, ride_status, sms_id } =
            req.body;

        // Get or create SMS setting
        let smsSettingId = sms_id;
        if (!smsSettingId) {
            const smsSetting = await prisma.sMSSetting.findFirst();
            smsSettingId = smsSetting?.id || null;
        }

        const template = await prisma.sMSTemplatRide.upsert({
            where: { type },
            update: {
                subject,
                smsDescription: sms_description,
                rideStatus: ride_status,
                smsId: smsSettingId ? parseInt(smsSettingId) : null,
            },
            create: {
                type,
                subject,
                smsDescription: sms_description,
                rideStatus: ride_status,
                smsId: smsSettingId ? parseInt(smsSettingId) : null,
            },
        });

        res.json({
            success: true,
            data: template,
            message: "SMS template saved successfully",
        });
    } catch (error) {
        console.error("Save ride SMS error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update SMS template
// @route   PUT /api/ride-sms/:id
// @access  Private (Admin)
export const updateRideSMS = async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, sms_description, ride_status } = req.body;

        const template = await prisma.sMSTemplatRide.update({
            where: { id: parseInt(id) },
            data: {
                subject,
                smsDescription: sms_description,
                rideStatus: ride_status,
            },
        });

        res.json({
            success: true,
            data: template,
            message: "SMS template updated successfully",
        });
    } catch (error) {
        console.error("Update ride SMS error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Delete SMS template
// @route   DELETE /api/ride-sms/:id
// @access  Private (Admin)
export const deleteRideSMS = async (req, res) => {
    try {
        const { id } = req.params;

        await prisma.sMSTemplatRide.delete({
            where: { id: parseInt(id) },
        });

        res.json({
            success: true,
            message: "SMS template deleted successfully",
        });
    } catch (error) {
        console.error("Delete ride SMS error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



