import { Router } from 'express';
import { confirmPaymentHandler, initiatePaymentHandler, paystackWebhookHandler } from '../controllers/payment.controller';

const router = Router();

// Paystack webhook - no auth required (verified by signature)
router.post('/webhook', paystackWebhookHandler);

// Payment routes are shared by guest and authenticated buyers.
router.post('/initiate', initiatePaymentHandler);
router.post('/confirm', confirmPaymentHandler);

export default router;
