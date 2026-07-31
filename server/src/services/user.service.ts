import { randomBytes } from 'crypto';
import { pool } from '../config/db';
import bcrypt from 'bcrypt';

function generateReferralCode() {
  return randomBytes(4).toString('hex');
}

function getApprovedAdminEmails() {
  const raw = [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .filter((value): value is string => Boolean(value))
    .join(',');

  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isApprovedAdminEmail(email: string) {
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail) return false;
  return getApprovedAdminEmails().includes(normalizedEmail);
}

export function resolveUserRole(email: string, fallbackRole?: string) {
  if (isApprovedAdminEmail(email)) {
    return 'admin' as const;
  }
  return fallbackRole === 'admin' ? 'admin' : 'user';
}

export async function findUserByEmail(email: string) {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return (rows as any[])[0] || null;
}

export async function findUserById(id: number) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return (rows as any[])[0] || null;
}

export async function findUserByReferralCode(code: string) {
  const [rows] = await pool.query('SELECT * FROM users WHERE referral_code = ? LIMIT 1', [code]);
  return (rows as any[])[0] || null;
}

export async function ensureUserReferralCode(userId: number) {
  const user = await findUserById(userId);
  if (!user) return null;
  if (user.referral_code) return user.referral_code;

  let code = generateReferralCode();
  let tries = 0;
  while (tries < 10) {
    const existing = await findUserByReferralCode(code);
    if (!existing) break;
    code = generateReferralCode();
    tries += 1;
  }

  await pool.query('UPDATE users SET referral_code = ? WHERE id = ?', [code, userId]);
  return code;
}

export async function createUser({
  name,
  email,
  password,
  role,
}: {
  name: string;
  email: string;
  password: string;
  role?: string;
}) {
  const resolvedRole = resolveUserRole(email, role);
  const password_hash = await bcrypt.hash(password, 12);
  let code = generateReferralCode();
  let tries = 0;
  while (tries < 10) {
    const [exists] = await pool.query('SELECT id FROM users WHERE referral_code = ? LIMIT 1', [code]);
    if (!(exists as any[]).length) break;
    code = generateReferralCode();
    tries += 1;
  }

  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, referral_code, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [name, email, password_hash, resolvedRole, code],
  );
  const insertId = (result as any).insertId;
  // create profile
  await pool.query('INSERT INTO profiles (user_id, name, created_at) VALUES (?, ?, NOW())', [insertId, name]);
  return { id: insertId, name, email, role: resolvedRole, referral_code: code };
}

export async function setUserReferralRewardUsed(userId: number, used: boolean) {
  await pool.query(
    'UPDATE users SET referral_reward_used_at = ? WHERE id = ?',
    [used ? new Date() : null, userId],
  );
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function updateUserRole(userId: number, role: string) {
  if (!['user', 'admin'].includes(role)) {
    return null;
  }
  const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  if ((result as any).affectedRows === 0) {
    return null;
  }
  const updated = await findUserById(userId);
  return updated;
}

export async function getAllUsersWithReferralStats(limit = 50) {
  const [rows] = await pool.query(
    `SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.referral_code,
      u.referral_reward_used_at,
      u.created_at,
      COALESCE(r.success_count, 0) AS successful_referral_count
     FROM users u
     LEFT JOIN (
       SELECT referrer_user_id, COUNT(*) AS success_count
       FROM referrals
       WHERE status = 'completed'
       GROUP BY referrer_user_id
     ) r ON r.referrer_user_id = u.id
     ORDER BY u.created_at DESC
     LIMIT ?`,
    [limit],
  );
  return rows as any[];
}

export async function getAdminDashboardStats() {
  const [usersRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_users,
      SUM(role = 'admin') AS total_admins
     FROM users`,
  );

  const [referralsRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_referrals,
      SUM(status = 'completed') AS completed_referrals,
      SUM(status = 'pending') AS pending_referrals
     FROM referrals`,
  );

  const [ordersRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_orders,
      COALESCE(SUM(total_amount), 0) AS total_revenue,
      SUM(payment_status = 'paid') AS paid_orders
     FROM orders`,
  );

  return {
    ...(usersRows as any[])[0],
    ...(referralsRows as any[])[0],
    ...(ordersRows as any[])[0],
  } as any;
}
