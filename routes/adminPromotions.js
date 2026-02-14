import express from 'express';
import * as ctrl from '../controllers/promotionController.js';
import { promotionErrorHandler } from '../middleware/promotionErrorHandler.js';

const router = express.Router();

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/toggle', ctrl.toggle);

router.use(promotionErrorHandler);
export default router;
