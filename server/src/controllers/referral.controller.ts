import { Request, Response } from 'express';
import {
  completeReferralForReferredUserId,
  countSuccessfulReferrals,
  getAllReferrals,
  getReferralById,
  getReferralStatusForUser,
  getReferralsForReferrerId,
  setReferrerRewardUsed,
  updateReferralStatus,
} from '../services/referral.service';
import { ensureUserReferralCode, findUserById } from '../services/user.service';

export async function getMyReferralStatus(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const referralCode = await ensureUserReferralCode(userId);
    const status = await getReferralStatusForUser(userId);
    return res.json({ referralCode, ...status });
  } catch (error) {
    console.error('Failed to load referral status:', error);
    return res.status(500).json({ message: 'Unable to load referral status' });
  }
}

export async function getMyReferrals(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const referrals = await getReferralsForReferrerId(userId);
    const successfulCount = referrals.filter((r) => r.status === 'completed').length;
    return res.json({ referrals, successfulCount });
  } catch (error) {
    console.error('Failed to load referrals:', error);
    return res.status(500).json({ message: 'Unable to load referrals' });
  }
}

export async function adminGetReferrals(req: Request, res: Response) {
  try {
    const referrals = await getAllReferrals();
    return res.json(referrals);
  } catch (error) {
    console.error('Failed to load admin referrals:', error);
    return res.status(500).json({ message: 'Unable to load referrals' });
  }
}

export async function adminUpdateReferral(req: Request, res: Response) {
  try {
    const referralId = Number(req.params.referralId);
    const { status, reward_used } = req.body;
    const referral = await getReferralById(referralId);
    if (!referral) return res.status(404).json({ message: 'Referral not found' });

    if (status) {
      await updateReferralStatus(referralId, status);
    }

    if (typeof reward_used === 'boolean') {
      const referrer = await findUserById(referral.referrer_user_id);
      if (!referrer) return res.status(404).json({ message: 'Referrer not found' });
      await setReferrerRewardUsed(referral.referrer_user_id, reward_used);
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update referral:', error);
    return res.status(500).json({ message: 'Unable to update referral' });
  }
}
