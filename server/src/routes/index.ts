import { Router } from 'express';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import notificationsRoutes from './notifications.routes';
import ordersRoutes from './orders.routes';
import paymentRoutes from './payment.routes';
import productsRoutes from './products.routes';
import { referralRoutes, referralAdminRoutes } from './referral.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productsRoutes);
router.use('/orders', ordersRoutes);
router.use('/admin', adminRoutes);
router.use('/admin/referrals', referralAdminRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/payments', paymentRoutes);
router.use('/referrals', referralRoutes);

export default router;
