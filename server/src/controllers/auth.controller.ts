import { Request, Response } from 'express';
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByReferralCode,
  resolveUserRole,
  updateUserPassword,
  updateUserProfile,
  verifyPassword,
} from '../services/user.service';
import { createReferral } from '../services/referral.service';
import {
  consumeResetToken,
  createPasswordResetToken,
  findValidResetToken,
  invalidateUserResetTokens,
} from '../services/password-reset.service';
import {
  sendLoginNotificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from '../services/auth-email.service';
import { clearAuthCookie, getAuthToken, setAuthCookie, signToken } from '../utils/jwt';
import { isValidEmail, isValidPassword } from '../middleware/validate.middleware';

const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'If an account exists with this email, a password reset link has been sent.';

export async function register(req: Request, res: Response) {
  try {
    const { full_name, email, password, confirm_password, referral_code } = req.body;

    if (!email || !password || !confirm_password || !full_name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!isValidPassword(String(password))) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.',
      });
    }

    if (String(password) !== String(confirm_password)) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const name = String(full_name).trim().slice(0, 120);

    const existing = await findUserByEmail(normalizedEmail);
    if (existing) return res.status(409).json({ message: 'Account already exists' });

    const user = await createUser({
      name,
      email: normalizedEmail,
      password,
      role: resolveUserRole(normalizedEmail),
    });

    if (referral_code) {
      const referrer = await findUserByReferralCode(String(referral_code).trim());
      if (referrer && referrer.id !== user.id && referrer.email.toLowerCase() !== user.email.toLowerCase()) {
        await createReferral(referrer.id, user.id, user.email, String(referral_code).trim());
      }
    }

    // Best-effort welcome email from support@brokeflexdata.com.
    // Never blocks registration — users can log in immediately.
    try {
      await sendWelcomeEmail({ userName: user.name, email: user.email });
    } catch (error: any) {
      console.warn('[Auth] Welcome email failed to send:', error?.message || error);
    }

    const token = signToken({ sub: user.id, role: user.role });
    setAuthCookie(res, token);
    return res.json({
      ok: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error('Registration failed:', error);
    return res.status(500).json({ message: 'Unable to create account' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Missing email or password' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      clearAuthCookie(res);
      return res.status(404).json({ message: 'Account not found.' });
    }

    const valid = await verifyPassword(String(password), user.password_hash);
    if (!valid) {
      clearAuthCookie(res);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const role = resolveUserRole(normalizedEmail, user.role);
    if (role === 'admin' && user.role !== 'admin') {
      await (await import('../services/user.service')).updateUserRole(user.id, 'admin');
    }

    const token = signToken({ sub: user.id, role });
    setAuthCookie(res, token);

    // Best-effort login notification email for security awareness.
    try {
      await sendLoginNotificationEmail({ userName: user.name, email: user.email });
    } catch (error: any) {
      console.warn('[Auth] Login notification email failed to send:', error?.message || error);
    }

    return res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, role } });
  } catch (error: any) {
    console.error('Login failed:', error);
    return res.status(500).json({ message: 'Unable to login' });
  }
}

export function logout(req: Request, res: Response) {
  clearAuthCookie(res);
  return res.json({ ok: true });
}

export async function updateProfile(req: Request, res: Response) {
  try {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const { verifyToken } = await import('../utils/jwt');
    const payloadVerified = verifyToken(token);
    if (!payloadVerified?.sub) {
      clearAuthCookie(res);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { findUserById } = await import('../services/user.service');
    const user = await findUserById(Number(payloadVerified.sub));
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, current_password, new_password, confirm_password } = req.body as {
      name?: string;
      current_password?: string;
      new_password?: string;
      confirm_password?: string;
    };

    const trimmedName = String(name ?? '').trim();
    if (name !== undefined && trimmedName.length < 2) {
      return res.status(400).json({ message: 'Display name must be at least 2 characters' });
    }

    if (new_password !== undefined || current_password !== undefined || confirm_password !== undefined) {
      if (!current_password || !new_password || !confirm_password) {
        return res.status(400).json({ message: 'Please fill in the current password, new password, and confirmation' });
      }
      if (!isValidPassword(String(new_password))) {
        return res.status(400).json({
          message:
            'New password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.',
        });
      }
      if (String(new_password) !== String(confirm_password)) {
        return res.status(400).json({ message: 'New passwords do not match' });
      }
      const valid = await verifyPassword(String(current_password), user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      await updateUserPassword(user.id, String(new_password));
    }

    if (name !== undefined) {
      await updateUserProfile(user.id, trimmedName || user.name);
    }

    const refreshedUser = await findUserById(user.id);
    const refreshedToken = signToken({ sub: refreshedUser.id, role: refreshedUser.role });
    setAuthCookie(res, refreshedToken);

    return res.json({
      ok: true,
      token: refreshedToken,
      user: {
        id: refreshedUser.id,
        name: refreshedUser.name,
        email: refreshedUser.email,
        role: refreshedUser.role,
        created_at: refreshedUser.created_at,
        referral_code: refreshedUser.referral_code,
      },
    });
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    return res.status(500).json({ message: 'Unable to update profile' });
  }
}

export async function me(req: Request, res: Response) {
  try {
    const token = getAuthToken(req);
    if (!token) return res.json({ user: null });

    const { verifyToken } = await import('../utils/jwt');
    const payloadVerified = verifyToken(token);
    if (!payloadVerified) {
      clearAuthCookie(res);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { findUserById } = await import('../services/user.service');
    const user = await findUserById(Number(payloadVerified.sub));
    if (!user) return res.json({ user: null });

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
        referral_code: user.referral_code,
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch user session:', error);
    return res.json({ user: null });
  }
}

/**
 * POST /api/auth/forgot-password
 * Sends a single-use, time-limited password reset link when an account exists.
 * Always responds with the same generic message to avoid leaking account existence.
 */
export async function forgotPassword(req: Request, res: Response) {
  try {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    if (!isValidEmail(rawEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    const user = await findUserByEmail(rawEmail);
    if (user) {
      const { rawToken, expiresAt } = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail({
        userName: user.name,
        email: user.email,
        rawToken,
        expiresAt,
      });
    }

    return res.json({ ok: true, message: GENERIC_FORGOT_PASSWORD_MESSAGE });
  } catch (error: any) {
    console.error('Failed to process password reset request:', error);
    return res.status(500).json({ message: 'Unable to process the password reset request.' });
  }
}

/**
 * POST /api/auth/reset-password
 * Validates a single-use reset token, then sets a new password for the account.
 */
export async function resetPassword(req: Request, res: Response) {
  try {
    const rawToken = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.new_password || '');
    const confirmPassword = String(req.body?.confirm_password || '');

    if (!rawToken) {
      return res.status(400).json({ message: 'Missing reset token.' });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        message:
          'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const valid = await findValidResetToken(rawToken);
    if (!valid) {
      return res.status(400).json({
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    const { tokenRow } = valid;

    // Double-check the user still exists before updating anything.
    const user = await findUserById(tokenRow.user_id);
    if (!user) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    await updateUserPassword(user.id, newPassword);
    await consumeResetToken(tokenRow.id);
    await invalidateUserResetTokens(user.id);

    // Clear any existing session cookie so the new password must be used next login.
    clearAuthCookie(res);

    return res.json({ ok: true, message: 'Your password has been reset. You can now log in.' });
  } catch (error: any) {
    console.error('Failed to reset password:', error);
    return res.status(500).json({ message: 'Unable to reset password.' });
  }
}
