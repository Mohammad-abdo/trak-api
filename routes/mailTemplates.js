import express from "express";
import {
    getMailTemplateList,
    getMailTemplateByType,
    saveMailTemplate,
    updateMailTemplate,
} from "../controllers/mailTemplateController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authenticate, authorize("admin"), getMailTemplateList);
router.get("/:type", authenticate, authorize("admin"), getMailTemplateByType);
router.post("/", authenticate, authorize("admin"), saveMailTemplate);
router.put("/:id", authenticate, authorize("admin"), updateMailTemplate);

export default router;



