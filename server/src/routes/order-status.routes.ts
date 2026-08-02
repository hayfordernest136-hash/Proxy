import { Router } from 'express';
import { getOrderStatusHandler } from '../controllers/order-status.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth);
router.get('/:reference', getOrderStatusHandler);

export default router;
