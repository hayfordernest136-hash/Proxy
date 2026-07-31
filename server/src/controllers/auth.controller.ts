import { Request, Response } from 'express';
import {
  createUser,
  findUserByEmail,
  findUserByReferralCode,
  resolveUserRole,
  verifyPassword,
} from '../services/user.service';
import { createReferral } from '../services/referral.service';
import { clearAuthCookie, setAuthCookie, signToken } from '../utils/jwt';
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

export async function me(req: Request, res: Response) {
  try {
    const token = req.cookies?.token;
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
