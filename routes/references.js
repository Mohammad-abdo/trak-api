import express from "express";
import { getReferenceList } from "../controllers/referenceController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Support both /references and /references/reference-list
router.get("/", authenticate, getReferenceList);
router.get("/reference-list", authenticate, getReferenceList);

export default router;

