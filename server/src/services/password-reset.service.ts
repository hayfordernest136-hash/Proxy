import { createHash, randomBytes } from 'crypto';
import { pool } from '../config/db';

/**
 * Password reset token service.
 *
 * Security properties:
 * - Tokens are generated with crypto.randomBytes(32) (256 bits of entropy).
 * - Only a SHA-256 hash of the token is stored in the database — the raw token
 *   is never persisted and can never be recovered from the DB.
 * - Tokens expire after 30 minutes.
 * - Tokens are single-use: using one marks it consumed immediately.
 * - Generating a new token invalidates all previous unused tokens for the user.
 */

export const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

export type PasswordResetTokenRow = {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date | string;
  used_at: Date | string | null;
  created_at: Date | string;
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new password reset token for the user. Invalidates all previous
 * unused tokens for the same user first (single active token per account).
 * Returns the raw token (to email to the user) and the expiry date.
 */
export async function createPasswordResetToken(userId: number): Promise<{ rawToken: string; expiresAt: Date }> {
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
    [userId],
  );

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, NOW())`,
    [userId, tokenHash, expiresAt],
  );

  return { rawToken, expiresAt };
}

/**
 * Look up a reset token by its raw value. Returns null when the token does not
 * exist, has already been used, or is expired. The associated user row is also
 * returned so the caller can update the password without a second query.
 */
export async function findValidResetToken(rawToken: string) {
  const tokenHash = hashToken(String(rawToken || '').trim());
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`,
    [tokenHash],
  );
  const tokenRow = rows[0] as PasswordResetTokenRow | undefined;
  if (!tokenRow) return null;

  const expiresAt =
    tokenRow.expires_at instanceof Date
      ? tokenRow.expires_at
      : new Date(String(tokenRow.expires_at));

  const usedAt = tokenRow.used_at
    ? tokenRow.used_at instanceof Date
      ? tokenRow.used_at
      : new Date(String(tokenRow.used_at))
    : null;

  // Single-use: reject tokens that have already been consumed.
  if (usedAt) return null;

  // Reject expired tokens.
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) return null;

  return { tokenRow, expiresAt };
}

/** Mark a token as consumed so it can never be used again. */
export async function consumeResetToken(tokenId: number): Promise<void> {
  await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`, [tokenId]);
}

/** Invalidate all unused tokens for a user (used after a successful reset). */
export async function invalidateUserResetTokens(userId: number): Promise<void> {
  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`,
    [userId],
  );
}

/** Housekeeping: purge expired and consumed tokens. */
export async function cleanupExpiredResetTokens(): Promise<void> {
  await pool.query(
    `DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used_at IS NOT NULL`,
  );
}

