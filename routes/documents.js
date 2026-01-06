import express from 'express';
import {
    getDocumentList,
    getDocumentDetail,
    createDocument,
    updateDocument,
    deleteDocument,
} from '../controllers/documentController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/document-list', getDocumentList);

// Admin CRUD routes
router.get('/:id', authenticate, authorize('admin'), getDocumentDetail);
router.post('/', authenticate, authorize('admin'), createDocument);
router.put('/:id', authenticate, authorize('admin'), updateDocument);
router.delete('/:id', authenticate, authorize('admin'), deleteDocument);

export default router;

