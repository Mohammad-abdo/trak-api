import express from "express";
import {
    getChatHistory,
    createChatMessage,
    updateChatMessage,
    deleteChatMessage,
} from "../controllers/supportChatHistoryController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.get("/:supportId", authenticate, getChatHistory);
router.post("/", authenticate, createChatMessage);
router.put("/:id", authenticate, updateChatMessage);
router.delete("/:id", authenticate, authorize("admin"), deleteChatMessage);

export default router;


