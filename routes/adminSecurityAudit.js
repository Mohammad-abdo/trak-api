import express from "express";
import { getSecurityAuditLogs } from "../controllers/securityAuditLogController.js";

const router = express.Router();

router.get("/", getSecurityAuditLogs);

export default router;
