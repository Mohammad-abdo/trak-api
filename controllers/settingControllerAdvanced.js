import prisma from "../utils/prisma.js";

// @desc    Update payment settings
// @route   POST /api/settings/payment
// @access  Private (Admin)
export const updatePaymentSettings = async (req, res) => {
    try {
        const { type, settings } = req.body;

        if (type) {
            const gateway = await prisma.paymentGateway.findFirst({
                where: { type },
            });

            if (gateway) {
                await prisma.paymentGateway.update({
                    where: { id: gateway.id },
                    data: {
                        testValue: settings.testValue || gateway.testValue,
                        liveValue: settings.liveValue || gateway.liveValue,
                        status: settings.status !== undefined ? settings.status : gateway.status,
                        isTest: settings.isTest !== undefined ? settings.isTest : gateway.isTest,
                    },
                });
            }
        }

        if (settings) {
            for (const [key, value] of Object.entries(settings)) {
                if (key.startsWith('PAYMENT_') || key.startsWith('CURRENCY_')) {
                    await prisma.setting.upsert({
                        where: { key },
                        update: { value: String(value) },
                        create: { key, value: String(value) },
                    });
                }
            }
        }

        res.json({
            success: true,
            message: "Payment settings updated successfully",
        });
    } catch (error) {
        console.error("Update payment settings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update wallet settings
// @route   POST /api/settings/wallet
// @access  Private (Admin)
export const updateWalletSettings = async (req, res) => {
    try {
        const settings = req.body;
        const walletSettings = [
            'min_amount_to_add',
            'max_amount_to_add',
            'min_amount_to_get_ride',
            'preset_topup_amount',
        ];

        for (const key of walletSettings) {
            if (settings[key] !== undefined) {
                await prisma.setting.upsert({
                    where: { key },
                    update: { value: String(settings[key]) },
                    create: { key, value: String(settings[key]) },
                });
            }
        }

        res.json({
            success: true,
            message: "Wallet settings updated successfully",
        });
    } catch (error) {
        console.error("Update wallet settings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update ride settings
// @route   POST /api/settings/ride
// @access  Private (Admin)
export const updateRideSettings = async (req, res) => {
    try {
        const settings = req.body;
        const rideSettings = [
            'max_time_for_find_drivers_for_regular_ride_in_minute',
            'ride_accept_decline_duration_for_driver_in_second',
            'preset_tip_amount',
            'apply_additional_fee',
            'surge_price',
            'is_bidding',
            'is_sms_rider',
        ];

        for (const key of rideSettings) {
            if (settings[key] !== undefined) {
                await prisma.setting.upsert({
                    where: { key },
                    update: { value: String(settings[key]) },
                    create: { key, value: String(settings[key]) },
                });
            }
        }

        res.json({
            success: true,
            message: "Ride settings updated successfully",
        });
    } catch (error) {
        console.error("Update ride settings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update notification settings
// @route   POST /api/settings/notification
// @access  Private (Admin)
export const updateNotificationSettings = async (req, res) => {
    try {
        const settings = req.body;
        const notificationSettings = [
            'IS_ONESIGNAL',
            'ONESIGNAL_APP_ID',
            'ONESIGNAL_REST_API_KEY',
            'FIREBASE_SERVER_KEY',
            'FIREBASE_SENDER_ID',
        ];

        for (const key of notificationSettings) {
            if (settings[key] !== undefined) {
                await prisma.setting.upsert({
                    where: { key },
                    update: { value: String(settings[key]) },
                    create: { key, value: String(settings[key]) },
                });
            }
        }

        res.json({
            success: true,
            message: "Notification settings updated successfully",
        });
    } catch (error) {
        console.error("Update notification settings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update SMS settings
// @route   POST /api/settings/sms
// @access  Private (Admin)
export const updateSMSSettings = async (req, res) => {
    try {
        const { type, settings } = req.body;

        if (type && settings) {
            for (const [key, value] of Object.entries(settings)) {
                await prisma.setting.upsert({
                    where: { key: `SMS_${type.toUpperCase()}_${key.toUpperCase()}` },
                    update: { value: String(value) },
                    create: {
                        key: `SMS_${type.toUpperCase()}_${key.toUpperCase()}`,
                        value: String(value),
                    },
                });
            }
        }

        res.json({
            success: true,
            message: "SMS settings updated successfully",
        });
    } catch (error) {
        console.error("Update SMS settings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update mail template settings
// @route   POST /api/settings/mail-template
// @access  Private (Admin)
export const updateMailTemplateSettings = async (req, res) => {
    try {
        const settings = req.body;
        const mailTemplateSettings = [
            'new_ride_requested',
            'accepted',
            'bid_placed',
            'bid_accepted',
            'bid_rejected',
            'arriving',
            'arrived',
            'in_progress',
            'canceled',
            'driver_canceled',
            'rider_canceled',
            'completed',
            'payment_status_message',
            'otp_verification_mail',
        ];

        for (const key of mailTemplateSettings) {
            if (settings[key] !== undefined) {
                await prisma.setting.upsert({
                    where: { key },
                    update: { value: String(settings[key]) },
                    create: { key, value: String(settings[key]) },
                });
            }
        }

        res.json({
            success: true,
            message: "Mail template settings updated successfully",
        });
    } catch (error) {
        console.error("Update mail template settings error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Update driver rejection block settings
// @route   POST /api/settings/driver-rejection
// @access  Private (Admin)
export const updateDriverRejectionSettings = async (req, res) => {
    try {
        const { enabled, maxCount, cooldownHours } = req.body;
        const updates = [];

        if (enabled !== undefined) {
            if (typeof enabled !== "boolean" && enabled !== 0 && enabled !== 1 && enabled !== "0" && enabled !== "1") {
                return res.status(400).json({ success: false, message: "`enabled` must be a boolean or 0/1" });
            }
            const val = enabled === true || enabled === 1 || enabled === "1" ? "1" : "0";
            updates.push({ key: "driver_rejection_block_enabled", value: val });
        }

        if (maxCount !== undefined) {
            const parsed = parseInt(maxCount, 10);
            if (Number.isNaN(parsed) || parsed < 1 || parsed > 50) {
                return res.status(400).json({ success: false, message: "`maxCount` must be an integer between 1 and 50" });
            }
            updates.push({ key: "driver_rejection_max_count", value: String(parsed) });
        }

        if (cooldownHours !== undefined) {
            const parsed = parseFloat(cooldownHours);
            if (Number.isNaN(parsed) || parsed <= 0 || parsed > 720) {
                return res.status(400).json({ success: false, message: "`cooldownHours` must be a number between 0.5 and 720" });
            }
            updates.push({ key: "driver_rejection_cooldown_duration", value: String(parsed) });
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields provided. Send at least one of: enabled, maxCount, cooldownHours",
            });
        }

        for (const { key, value } of updates) {
            await prisma.setting.upsert({
                where: { key },
                update: { value },
                create: { key, value },
            });
        }

        res.json({ success: true, message: "Driver rejection settings updated successfully" });
    } catch (error) {
        console.error("Update driver rejection settings error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get settings by category
// @route   GET /api/settings/category/:category
// @access  Private (Admin)
export const getSettingsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const categoryMap = {
            payment: ['PAYMENT_', 'CURRENCY_'],
            wallet: ['min_amount_to_add', 'max_amount_to_add', 'min_amount_to_get_ride', 'preset_topup_amount'],
            ride: ['max_time_for_find_drivers_for_regular_ride_in_minute', 'ride_accept_decline_duration_for_driver_in_second', 'preset_tip_amount', 'apply_additional_fee', 'surge_price', 'is_bidding', 'is_sms_rider'],
            notification: ['IS_ONESIGNAL', 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY', 'FIREBASE_SERVER_KEY', 'FIREBASE_SENDER_ID'],
            sms: ['SMS_'],
            'mail-template': ['new_ride_requested', 'accepted', 'bid_placed', 'bid_accepted', 'bid_rejected', 'arriving', 'arrived', 'in_progress', 'canceled', 'driver_canceled', 'rider_canceled', 'completed', 'payment_status_message', 'otp_verification_mail'],
            'driver-rejection': ['driver_rejection_block_enabled', 'driver_rejection_max_count', 'driver_rejection_cooldown_duration'],
        };

        const keys = categoryMap[category] || [];
        const allSettings = await prisma.setting.findMany();
        const settingsObj = {};

        allSettings.forEach((setting) => {
            for (const key of keys) {
                if (setting.key.startsWith(key) || setting.key === key) {
                    settingsObj[setting.key] = setting.value;
                }
            }
        });

        // For driver-rejection: return a structured object with defaults for missing keys
        if (category === 'driver-rejection') {
            const structured = {
                enabled: settingsObj['driver_rejection_block_enabled'] !== undefined
                    ? settingsObj['driver_rejection_block_enabled'] === '1'
                    : true,
                maxCount: settingsObj['driver_rejection_max_count'] !== undefined
                    ? parseInt(settingsObj['driver_rejection_max_count'], 10)
                    : 3,
                cooldownHours: settingsObj['driver_rejection_cooldown_duration'] !== undefined
                    ? parseFloat(settingsObj['driver_rejection_cooldown_duration'])
                    : 24,
                _raw: settingsObj,
            };
            return res.json({ success: true, data: structured });
        }

        res.json({
            success: true,
            data: settingsObj,
        });
    } catch (error) {
        console.error("Get settings by category error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

