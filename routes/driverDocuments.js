import express from "express";
import {
    getDriverDocumentList,
    saveDriverDocument,
    updateDriverDocument,
    deleteDriverDocument,
} from "../controllers/driverDocumentController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.get("/driver-document-list", authenticate, getDriverDocumentList);
router.post("/driver-document-save", authenticate, saveDriverDocument);
router.post("/driver-document-update/:id", authenticate, updateDriverDocument);
router.post("/driver-document-delete/:id", authenticate, deleteDriverDocument);

export default router;



