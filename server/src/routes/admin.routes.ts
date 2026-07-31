import { Router } from 'express';
import {
  getAdminDashboardHandler,
  getAdminOrdersHandler,
  getAdminUsersHandler,
  updateOrderHandler,
  updateUserRoleHandler,
} from '../controllers/admin.controller';
import { adminUploadHandler } from '../controllers/admin.upload.controller';
import {
  adminListProductsHandler,
  adminCreateProductHandler,
  adminUpdateProductHandler,
  adminDeleteProductHandler,
  adminCreatePlanHandler,
  adminUpdatePlanHandler,
  adminDeletePlanHandler,
} from '../controllers/admin.product.controller';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/dashboard', getAdminDashboardHandler);
router.get('/orders', getAdminOrdersHandler);
router.get('/users', getAdminUsersHandler);
router.patch('/users/:userId', updateUserRoleHandler);
router.patch('/orders/:orderId', updateOrderHandler);

// Product management
router.get('/products', adminListProductsHandler);
router.post('/products', adminCreateProductHandler);
router.patch('/products/:productId', adminUpdateProductHandler);
router.delete('/products/:productId', adminDeleteProductHandler);

// Plan management
router.post('/products/:productId/plans', adminCreatePlanHandler);
router.patch('/plans/:planId', adminUpdatePlanHandler);
router.delete('/plans/:planId', adminDeletePlanHandler);

// Uploads (base64)
router.post('/uploads', adminUploadHandler);

export default router;
