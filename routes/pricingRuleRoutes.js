import express from "express";
import {
    getPricingRules,
    getPricingRuleById,
    calculatePrice,
    createPricingRule,
    updatePricingRule,
    deletePricingRule,
} from "../controllers/pricingRuleController.js";

const router = express.Router();

// Public routes
router.get("/", getPricingRules);
router.get("/:id", getPricingRuleById);
router.post("/calculate", calculatePrice);

// Admin routes
router.post("/", createPricingRule);
router.put("/:id", updatePricingRule);
router.delete("/:id", deletePricingRule);

export default router;
