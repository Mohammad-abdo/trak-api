import mqtt from "mqtt";

let mqttClient = null;
const subscribers = new Map(); // topic -> callback[]

/**
 * Initialize MQTT connection
 */
export const initializeMQTT = () => {
    try {
        const mqttHost = process.env.MQTT_HOST || "localhost";
        const mqttPort = process.env.MQTT_PORT || 1883;
        const mqttClientId = process.env.MQTT_CLIENT_ID || `taxi_backend_${Date.now()}`;
        const mqttUsername = process.env.MQTT_USERNAME;
        const mqttPassword = process.env.MQTT_PASSWORD;
        const mqttTopicPrefix = process.env.MQTT_UNIQUE_TOPIC_NAME || "mightytaxi";

        const options = {
            clientId: mqttClientId,
            clean: process.env.MQTT_CLEAN_SESSION !== "false",
            reconnectPeriod: 1000,
            connectTimeout: 30 * 1000,
        };

        if (mqttUsername && mqttPassword) {
            options.username = mqttUsername;
            options.password = mqttPassword;
        }

        const brokerUrl = `mqtt://${mqttHost}:${mqttPort}`;

        mqttClient = mqtt.connect(brokerUrl, options);

        mqttClient.on("connect", () => {
            console.log("MQTT client connected");
        });

        mqttClient.on("error", (error) => {
            console.error("MQTT connection error:", error);
        });

        mqttClient.on("message", (topic, message) => {
            const messageStr = message.toString();
            const callbacks = subscribers.get(topic);
            if (callbacks) {
                callbacks.forEach((callback) => {
                    try {
                        callback(topic, messageStr);
                    } catch (error) {
                        console.error("MQTT callback error:", error);
                    }
                });
            }
        });

        mqttClient.on("reconnect", () => {
            console.log("MQTT client reconnecting...");
        });

        mqttClient.on("close", () => {
            console.log("MQTT client disconnected");
        });

        return mqttClient;
    } catch (error) {
        console.error("MQTT initialization error:", error);
        return null;
    }
};

/**
 * Publish message to MQTT topic
 */
export const publishMQTT = (event, message) => {
    try {
        if (!mqttClient || !mqttClient.connected) {
            console.warn("MQTT client not connected, attempting to initialize...");
            initializeMQTT();
            // Wait a bit for connection
            setTimeout(() => {
                if (mqttClient && mqttClient.connected) {
                    _publish(event, message);
                } else {
                    console.error("MQTT client still not connected");
                }
            }, 1000);
            return;
        }

        _publish(event, message);
    } catch (error) {
        console.error("MQTT publish error:", error);
    }
};

const _publish = (event, message) => {
    const mqttTopicPrefix = process.env.MQTT_UNIQUE_TOPIC_NAME || "mightytaxi";
    const topic = `${mqttTopicPrefix}_${event}`;
    const messageStr = typeof message === "string" ? message : JSON.stringify(message);

    mqttClient.publish(topic, messageStr, { qos: 1 }, (error) => {
        if (error) {
            console.error(`MQTT publish error to topic ${topic}:`, error);
        } else {
            console.log(`MQTT message published to topic: ${topic}`);
        }
    });
};

/**
 * Subscribe to MQTT topic
 */
export const subscribeMQTT = (topic, callback) => {
    try {
        if (!mqttClient || !mqttClient.connected) {
            console.warn("MQTT client not connected, attempting to initialize...");
            initializeMQTT();
            setTimeout(() => {
                if (mqttClient && mqttClient.connected) {
                    _subscribe(topic, callback);
                }
            }, 1000);
            return;
        }

        _subscribe(topic, callback);
    } catch (error) {
        console.error("MQTT subscribe error:", error);
    }
};

const _subscribe = (topic, callback) => {
    // Store callback
    if (!subscribers.has(topic)) {
        subscribers.set(topic, []);
    }
    subscribers.get(topic).push(callback);

    // Subscribe to topic
    mqttClient.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
            console.error(`MQTT subscribe error to topic ${topic}:`, error);
        } else {
            console.log(`MQTT subscribed to topic: ${topic}`);
        }
    });
};

/**
 * Unsubscribe from MQTT topic
 */
export const unsubscribeMQTT = (topic, callback) => {
    try {
        const callbacks = subscribers.get(topic);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }

            if (callbacks.length === 0) {
                subscribers.delete(topic);
                if (mqttClient && mqttClient.connected) {
                    mqttClient.unsubscribe(topic);
                }
            }
        }
    } catch (error) {
        console.error("MQTT unsubscribe error:", error);
    }
};

/**
 * Get MQTT client instance
 */
export const getMQTTClient = () => {
    if (!mqttClient || !mqttClient.connected) {
        initializeMQTT();
    }
    return mqttClient;
};

