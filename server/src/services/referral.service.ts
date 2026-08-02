import { pool } from "../config/db";
import { createNotification } from "./notification.service";
import { findUserById, setUserReferralRewardUsed } from "./user.service";

export type ReferralRow = {
  id: number;
  referrer_user_id: number;
  referred_user_id: number;
  referred_email: string;
  source_referral_code: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export type ReferralDetailRow = ReferralRow & {
  referrer_name: string | null;
  referrer_email: string | null;
  referred_name: string | null;
  referral_reward_used_at: string | null;
};

export async function createReferral(
  referrerUserId: number,
  referredUserId: number,
  referredEmail: string,
  sourceReferralCode: string,
) {
  const [rows] = await pool.query(
    "INSERT INTO referrals (referrer_user_id, referred_user_id, referred_email, source_referral_code, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [referrerUserId, referredUserId, referredEmail, sourceReferralCode, "pending"],
  );
  return (rows as any).insertId;
}

export async function getReferralByReferredUserId(referredUserId: number) {
  const [rows] = await pool.query("SELECT * FROM referrals WHERE referred_user_id = ? LIMIT 1", [
    referredUserId,
  ]);
  return (rows as any[])[0] || null;
}

export async function getReferralById(referralId: number) {
  const [rows] = await pool.query("SELECT * FROM referrals WHERE id = ? LIMIT 1", [referralId]);
  return (rows as any[])[0] || null;
}

export async function getReferralsForReferrerId(referrerUserId: number) {
  const [rows] = await pool.query(
    `SELECT
      r.*,
      referrer.name AS referrer_name,
      referrer.email AS referrer_email,
      referred.name AS referred_name,
      referred.email AS referred_email,
      referrer.referral_reward_used_at
     FROM referrals r
     LEFT JOIN users referrer ON referrer.id = r.referrer_user_id
     LEFT JOIN users referred ON referred.id = r.referred_user_id
     WHERE r.referrer_user_id = ?
     ORDER BY r.created_at DESC`,
    [referrerUserId],
  );
  return rows as ReferralDetailRow[];
}

export async function getAllReferrals() {
  const [rows] = await pool.query(
    `SELECT
      r.*,
      referrer.name AS referrer_name,
      referrer.email AS referrer_email,
      referred.name AS referred_name,
      referred.email AS referred_email,
      referrer.referral_reward_used_at
     FROM referrals r
     LEFT JOIN users referrer ON referrer.id = r.referrer_user_id
     LEFT JOIN users referred ON referred.id = r.referred_user_id
     ORDER BY r.created_at DESC`,
  );
  return rows as ReferralDetailRow[];
}

export async function countSuccessfulReferrals(referrerUserId: number) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM referrals WHERE referrer_user_id = ? AND status = ?",
    [referrerUserId, "completed"],
  );
  return Number((rows as any[])[0]?.count ?? 0);
}

export async function getReferralStatusForUser(referrerUserId: number) {
  const successfulReferrals = await countSuccessfulReferrals(referrerUserId);
  const referrer = await findUserById(referrerUserId);
  const rewardUsed = !!referrer?.referral_reward_used_at;
  const unlocked = successfulReferrals >= 10;
  let rewardStatus = "locked";
  if (rewardUsed) rewardStatus = "used";
  else if (unlocked) rewardStatus = "unlocked";

  return {
    successfulReferrals,
    rewardUsed,
    rewardStatus,
    rewardProgress: Math.min(successfulReferrals, 10),
    rewardUnlocked: unlocked,
  };
}

export async function completeReferralForReferredUserId(referredUserId: number, orderId: number) {
  const [result] = await pool.query(
    "UPDATE referrals SET status = ?, completed_at = NOW() WHERE referred_user_id = ? AND status = ?",
    ["completed", referredUserId, "pending"],
  );

  if ((result as any).affectedRows === 0) {
    return null;
  }

  const referral = await getReferralByReferredUserId(referredUserId);
  if (!referral) {
    return null;
  }

  const successfulCount = await countSuccessfulReferrals(referral.referrer_user_id);
  if (successfulCount === 10) {
    await createNotification(
      referral.referrer_user_id,
      orderId,
      "Referral reward unlocked",
      "You just earned a one-time 50% discount on a 10 IP proxy package. Use it at checkout.",
    );
  }

  return referral;
}

export async function updateReferralStatus(referralId: number, status: string) {
  await pool.query("UPDATE referrals SET status = ? WHERE id = ?", [status, referralId]);
  return getReferralById(referralId);
}

export async function setReferrerRewardUsed(userId: number, used: boolean) {
  return setUserReferralRewardUsed(userId, used);
}
