import express from "express";
import { getFaqList, createFaq, updateFaq, deleteFaq } from "../controllers/faqController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/faq-list", authenticate, getFaqList);
router.post("/", authenticate, createFaq);
router.put("/:id", authenticate, updateFaq);
router.delete("/:id", authenticate, deleteFaq);

export default router;


