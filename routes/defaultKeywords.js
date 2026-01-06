import express from "express";
import {
    getDefaultKeywordList,
    createDefaultKeyword,
    updateDefaultKeyword,
    deleteDefaultKeyword,
} from "../controllers/defaultKeywordController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getDefaultKeywordList);
router.post("/", authenticate, authorize("admin"), createDefaultKeyword);
router.put("/:id", authenticate, authorize("admin"), updateDefaultKeyword);
router.delete("/:id", authenticate, authorize("admin"), deleteDefaultKeyword);

export default router;



