import express from "express";
import {
    publishMessage,
    subscribeToTopic,
    getMQTTStatus,
} from "../controllers/mqttController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.post("/publish", authenticate, authorize("admin"), publishMessage);
router.post("/subscribe", authenticate, authorize("admin"), subscribeToTopic);
router.get("/status", authenticate, authorize("admin"), getMQTTStatus);

export default router;

