import express from 'express';
import * as ctrl from '../controllers/dedicatedBookingController.js';
import * as pricingCtrl from '../controllers/dedicatedBookingPricingController.js';
import { dedicatedBookingErrorHandler } from '../middleware/dedicatedBookingErrorHandler.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/pricing', pricingCtrl.getPricing);
router.put('/pricing', pricingCtrl.updatePricing);

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/available', authenticate, authorize('driver'), ctrl.listAvailable);
router.get('/:id/invoice', ctrl.getInvoice);
router.get('/:id', ctrl.getById);
router.patch('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.remove);

router.post('/:id/assign-driver', authenticate, authorize('admin', 'fleet'), ctrl.assignDriver);
router.post('/:id/accept', authenticate, authorize('driver'), ctrl.acceptByDriver);
router.post('/:id/start', ctrl.start);
router.post('/:id/end', ctrl.end);
router.post('/:id/cancel', ctrl.cancel);

router.use(dedicatedBookingErrorHandler);

export default router;
