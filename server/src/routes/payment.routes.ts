import { Router } from 'express';
import { confirmPaymentHandler, initiatePaymentHandler, paystackWebhookHandler } from '../controllers/payment.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Paystack webhook - no auth required (verified by signature)
router.post('/webhook', paystackWebhookHandler);

// Authenticated payment routes
router.post('/initiate', requireAuth, initiatePaymentHandler);
router.post('/confirm', requireAuth, confirmPaymentHandler);

export default router;
