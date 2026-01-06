import express from "express";
import { getCancellationList } from "../controllers/cancellationController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/cancelReason-list", authenticate, getCancellationList);

export default router;



