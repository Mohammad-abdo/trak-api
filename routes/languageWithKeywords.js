import express from "express";
import {
    getLanguageWithKeywordList,
    createLanguageWithKeyword,
    updateLanguageWithKeyword,
    deleteLanguageWithKeyword,
    exportLanguageKeywords,
    importLanguageKeywords,
} from "../controllers/languageWithKeywordController.js";
import { authenticate, authorize } from "../middleware/auth.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", authenticate, authorize("admin"), getLanguageWithKeywordList);
router.post("/", authenticate, authorize("admin"), createLanguageWithKeyword);
router.put("/:id", authenticate, authorize("admin"), updateLanguageWithKeyword);
router.delete("/:id", authenticate, authorize("admin"), deleteLanguageWithKeyword);
router.get("/export", authenticate, authorize("admin"), exportLanguageKeywords);
router.post("/import", authenticate, authorize("admin"), upload.single("file"), importLanguageKeywords);

export default router;



