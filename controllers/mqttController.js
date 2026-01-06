import { publishMQTT, subscribeMQTT, unsubscribeMQTT, initializeMQTT, getMQTTClient } from "../utils/mqttService.js";

// @desc    Publish message to MQTT topic
// @route   POST /api/mqtt/publish
// @access  Private (Admin)
export const publishMessage = async (req, res) => {
    try {
        const { topic, message, event } = req.body;

        if (!topic && !event) {
            return res.status(400).json({
                success: false,
                message: "Topic or event is required",
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                message: "Message is required",
            });
        }

        const mqttTopic = topic || event;
        publishMQTT(mqttTopic, message);

        res.json({
            success: true,
            message: "Message published successfully",
            data: {
                topic: mqttTopic,
                message: typeof message === "string" ? message : JSON.stringify(message),
            },
        });
    } catch (error) {
        console.error("Publish MQTT message error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Subscribe to MQTT topic
// @route   POST /api/mqtt/subscribe
// @access  Private (Admin)
export const subscribeToTopic = async (req, res) => {
    try {
        const { topic } = req.body;

        if (!topic) {
            return res.status(400).json({
                success: false,
                message: "Topic is required",
            });
        }

        // For HTTP subscription, we'll just confirm subscription
        // Actual message handling should be done via WebSocket or polling
        subscribeMQTT(topic, (receivedTopic, message) => {
            console.log(`Received message on topic ${receivedTopic}: ${message}`);
        });

        res.json({
            success: true,
            message: `Subscribed to topic: ${topic}`,
            data: { topic },
        });
    } catch (error) {
        console.error("Subscribe MQTT topic error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// @desc    Get MQTT connection status
// @route   GET /api/mqtt/status
// @access  Private (Admin)
export const getMQTTStatus = async (req, res) => {
    try {
        const client = getMQTTClient();
        const isConnected = client && client.connected;

        res.json({
            success: true,
            data: {
                connected: isConnected,
                host: process.env.MQTT_HOST || "localhost",
                port: process.env.MQTT_PORT || 1883,
                topicPrefix: process.env.MQTT_UNIQUE_TOPIC_NAME || "mightytaxi",
            },
        });
    } catch (error) {
        console.error("Get MQTT status error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

