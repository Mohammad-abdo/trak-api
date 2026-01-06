import express from 'express';
import { generateRideInvoice } from '../controllers/invoiceController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/ride/:id', authenticate, generateRideInvoice);

export default router;

