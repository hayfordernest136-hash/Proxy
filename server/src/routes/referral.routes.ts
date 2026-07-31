import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import {
  getMyReferralStatus,
  getMyReferrals,
  adminGetReferrals,
  adminUpdateReferral,
} from '../controllers/referral.controller';

const router = Router();
router.use(requireAuth);
router.get('/status', getMyReferralStatus);
router.get('/', getMyReferrals);

const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/', adminGetReferrals);
adminRouter.patch('/:referralId', adminUpdateReferral);

export { router as referralRoutes, adminRouter as referralAdminRoutes };
