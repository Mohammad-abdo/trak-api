import express from "express";
import {
    getLanguageList,
    createLanguage,
    updateLanguage,
    deleteLanguage,
} from "../controllers/languageListController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getLanguageList);
router.post("/", authenticate, authorize("admin"), createLanguage);
router.put("/:id", authenticate, authorize("admin"), updateLanguage);
router.delete("/:id", authenticate, authorize("admin"), deleteLanguage);

export default router;



