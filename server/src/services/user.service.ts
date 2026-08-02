import { randomBytes } from "crypto";
import { pool } from "../config/db";
import bcrypt from "bcrypt";

function generateReferralCode() {
  return randomBytes(4).toString("hex");
}

function getApprovedAdminEmails() {
  const raw = [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .filter((value): value is string => Boolean(value))
    .join(",");

  return raw
    .split(",")
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
    return "admin" as const;
  }
  return fallbackRole === "admin" ? "admin" : "user";
}

export async function findUserByEmail(email: string) {
  const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
  return (rows as any[])[0] || null;
}

export async function findUserById(id: number) {
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [id]);
  return (rows as any[])[0] || null;
}

export async function findUserByReferralCode(code: string) {
  const [rows] = await pool.query("SELECT * FROM users WHERE referral_code = ? LIMIT 1", [code]);
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

  await pool.query("UPDATE users SET referral_code = ? WHERE id = ?", [code, userId]);
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
    const [exists] = await pool.query("SELECT id FROM users WHERE referral_code = ? LIMIT 1", [
      code,
    ]);
    if (!(exists as any[]).length) break;
    code = generateReferralCode();
    tries += 1;
  }

  const [result] = await pool.query(
    "INSERT INTO users (name, email, password_hash, role, referral_code, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [name, email, password_hash, resolvedRole, code],
  );
  const insertId = (result as any).insertId;
  // create profile
  await pool.query("INSERT INTO profiles (user_id, name, created_at) VALUES (?, ?, NOW())", [
    insertId,
    name,
  ]);
  return { id: insertId, name, email, role: resolvedRole, referral_code: code };
}

export async function setUserReferralRewardUsed(userId: number, used: boolean) {
  await pool.query("UPDATE users SET referral_reward_used_at = ? WHERE id = ?", [
    used ? new Date() : null,
    userId,
  ]);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function updateUserProfile(userId: number, name: string) {
  await pool.query("UPDATE users SET name = ? WHERE id = ?", [name, userId]);
  await pool.query("UPDATE profiles SET name = ? WHERE user_id = ?", [name, userId]);
  return findUserById(userId);
}

export async function updateUserPassword(userId: number, password: string) {
  const password_hash = await bcrypt.hash(password, 12);
  await pool.query("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, userId]);
  return findUserById(userId);
}

export async function updateUserRole(userId: number, role: string) {
  if (!["user", "admin"].includes(role)) {
    return null;
  }
  const [result] = await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);
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
  const [summaryRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_orders,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS total_completed_orders,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS total_processing_orders,
      SUM(CASE WHEN status IN ('awaiting_payment', 'paid', 'purchasing_proxy', 'delivering') THEN 1 ELSE 0 END) AS total_pending_orders,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS total_failed_orders,
      SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS total_refunded_orders,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS total_cancelled_orders,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS today_revenue,
      COALESCE(SUM(CASE WHEN DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURRENT_DATE, '%Y-%m') AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS month_revenue,
      SUM(CASE WHEN delivery_method = 'data_bundle' THEN 1 ELSE 0 END) AS total_data_orders,
      SUM(CASE WHEN delivery_method <> 'data_bundle' THEN 1 ELSE 0 END) AS total_proxy_orders,
      COALESCE(SUM(CASE WHEN delivery_method = 'data_bundle' AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS total_data_sales,
      COALESCE(SUM(CASE WHEN delivery_method <> 'data_bundle' AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS total_proxy_sales,
      SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) AS total_guest_orders,
      COUNT(DISTINCT CASE WHEN user_id IS NULL THEN COALESCE(NULLIF(customer_email, ''), NULLIF(refill_email, '')) ELSE NULL END) AS total_guest_customers,
      COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id ELSE NULL END) AS total_active_customers
     FROM orders`,
  );

  const [customerRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_registered_customers,
      SUM(role = 'admin') AS total_admins
     FROM users`,
  );

  const [productRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_proxy_products
     FROM products
     WHERE supports_cd_key = 1 OR supports_account_refill = 1`,
  );

  const [emailRows] = await pool.query(
    `SELECT
      COUNT(*) AS total_emails_sent,
      SUM(status = 'failed') AS total_failed_emails
     FROM email_logs`,
  );

  const [topBundlesRows] = await pool.query(
    `SELECT
      COALESCE(plan_name, 'Unknown bundle') AS bundle,
      COUNT(*) AS orders,
      COALESCE(SUM(total_amount), 0) AS revenue
     FROM orders
     WHERE delivery_method = 'data_bundle'
     GROUP BY bundle
     ORDER BY orders DESC
     LIMIT 5`,
  );

  const [topProxyRows] = await pool.query(
    `SELECT
      COALESCE(product_name, 'Unknown product') AS product,
      COUNT(*) AS orders,
      COALESCE(SUM(total_amount), 0) AS revenue
     FROM orders
     WHERE delivery_method <> 'data_bundle'
     GROUP BY product
     ORDER BY orders DESC
     LIMIT 5`,
  );

  const [statusRows] = await pool.query(
    `SELECT
      status,
      COUNT(*) AS count
     FROM orders
     GROUP BY status`,
  );

  const [guestRows] = await pool.query(
    `SELECT
      SUM(user_id IS NULL) AS guest_orders,
      SUM(user_id IS NOT NULL) AS registered_orders
     FROM orders`,
  );

  const [revenueByNetworkRows] = await pool.query(
    `SELECT
      COALESCE(NULLIF(proxy_type, ''), 'Unknown') AS name,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue
     FROM orders
     WHERE delivery_method = 'data_bundle'
     GROUP BY name
     ORDER BY revenue DESC
     LIMIT 8`,
  );

  const [revenueByProxyTypeRows] = await pool.query(
    `SELECT
      COALESCE(NULLIF(proxy_type, ''), 'Unknown') AS name,
      COALESCE(SUM(CASE WHEN delivery_method <> 'data_bundle' AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue
     FROM orders
     GROUP BY name
     ORDER BY revenue DESC
     LIMIT 8`,
  );

  const [dailySalesRows] = await pool.query(
    `SELECT
      DATE(created_at) AS date,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue,
      COUNT(*) AS orders
     FROM orders
     WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 13 DAY)
     GROUP BY DATE(created_at)
     ORDER BY DATE(created_at)`,
  );

  const [monthlyRevenueRows] = await pool.query(
    `SELECT
      DATE_FORMAT(created_at, '%Y-%m') AS period,
      COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS revenue
     FROM orders
     WHERE created_at >= DATE_FORMAT(DATE_SUB(CURRENT_DATE, INTERVAL 5 MONTH), '%Y-%m-01')
     GROUP BY period
     ORDER BY period`,
  );

  return {
    ...(summaryRows as any[])[0],
    ...(customerRows as any[])[0],
    ...(productRows as any[])[0],
    ...(emailRows as any[])[0],
    top_selling_bundles: topBundlesRows as any[],
    top_selling_proxy_products: topProxyRows as any[],
    order_status_distribution: statusRows as any[],
    guest_vs_registered: [
      { label: "Guest", value: Number((guestRows as any[])[0]?.guest_orders ?? 0) },
      { label: "Registered", value: Number((guestRows as any[])[0]?.registered_orders ?? 0) },
    ],
    revenue_by_network: revenueByNetworkRows as any[],
    revenue_by_proxy_type: revenueByProxyTypeRows as any[],
    daily_sales: (dailySalesRows as any[]).map((row) => ({
      date: String(row.date),
      revenue: Number(row.revenue ?? 0),
      orders: Number(row.orders ?? 0),
    })),
    monthly_revenue: (monthlyRevenueRows as any[]).map((row) => ({
      month: String(row.period),
      revenue: Number(row.revenue ?? 0),
    })),
  } as any;
}
