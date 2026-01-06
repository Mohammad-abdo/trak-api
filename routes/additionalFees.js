import express from "express";
import { getAdditionalFeesList } from "../controllers/additionalFeesController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/additional-fees-list", authenticate, getAdditionalFeesList);

export default router;



