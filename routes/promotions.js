import express from 'express';
import * as ctrl from '../controllers/promotionController.js';
import { promotionErrorHandler } from '../middleware/promotionErrorHandler.js';

const router = express.Router();

router.post('/validate', ctrl.validatePromotion);

router.use(promotionErrorHandler);
export default router;
