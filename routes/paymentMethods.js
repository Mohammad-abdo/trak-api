import express from "express";
import { authenticate } from "../middleware/auth.js";
import { list, create, update, toggleStatus, remove } from "../controllers/paymentMethodController.js";

const router = express.Router();

router.get("/", authenticate, list);
router.post("/", authenticate, create);
router.put("/:id", authenticate, update);
router.patch("/:id/toggle", authenticate, toggleStatus);
router.delete("/:id", authenticate, remove);

export default router;
