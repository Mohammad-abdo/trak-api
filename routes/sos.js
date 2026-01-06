import express from "express";
import {
    getSosList,
    saveSos,
    updateSos,
    deleteSos,
    adminSosNotify,
} from "../controllers/sosController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/sos-list", authenticate, getSosList);
router.post("/save-sos", authenticate, saveSos);
router.post("/sos-update/:id", authenticate, updateSos);
router.post("/sos-delete/:id", authenticate, deleteSos);
router.post("/admin-sos-notify", authenticate, adminSosNotify);

export default router;



