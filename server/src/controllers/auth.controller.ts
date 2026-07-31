import { Request, Response } from 'express';
import {
  createUser,
  findUserByEmail,
  findUserByReferralCode,
  resolveUserRole,
  updateUserPassword,
  updateUserProfile,
  verifyPassword,
} from '../services/user.service';
import { createReferral } from '../services/referral.service';
import { clearAuthCookie, getAuthToken, setAuthCookie, signToken } from '../utils/jwt';
import { isValidEmail, isValidPassword } from '../middleware/validate.middleware';

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
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
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
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    const valid = await verifyPassword(String(password), user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });

    const role = resolveUserRole(normalizedEmail, user.role);
    if (role === 'admin' && user.role !== 'admin') {
      await (await import('../services/user.service')).updateUserRole(user.id, 'admin');
    }

    const token = signToken({ sub: user.id, role });
    setAuthCookie(res, token);
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
      if (String(new_password).length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
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
      return res.json({ user: null });
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
