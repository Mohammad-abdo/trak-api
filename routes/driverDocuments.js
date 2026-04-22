import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
    getDriverDocumentList,
    saveDriverDocument,
    updateDriverDocument,
    deleteDriverDocument,
} from "../controllers/driverDocumentController.js";
import { authenticate } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage configuration for driver documents
const driverDocStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, "../uploads/driver-documents"));
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e4);
        cb(null, `doc_${timestamp}_${random}${path.extname(file.originalname)}`);
    },
});

const docUpload = multer({
    storage: driverDocStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, true);
    },
});

const router = express.Router();

router.get("/driver-document-list", authenticate, getDriverDocumentList);
router.post("/driver-document-save", authenticate, docUpload.single("documentImage"), saveDriverDocument);
router.post("/driver-document-update/:id", authenticate, docUpload.single("documentImage"), updateDriverDocument);
router.post("/driver-document-delete/:id", authenticate, deleteDriverDocument);

export default router;



