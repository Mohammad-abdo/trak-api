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

