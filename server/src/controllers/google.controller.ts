import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { findUserByEmail, createUser, resolveUserRole } from '../services/user.service';
import { signToken } from '../utils/jwt';

const googleClient = new OAuth2Client();

function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is required for Google OAuth');
  }
  return clientId;
}

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    ...(isProd ? { domain: undefined } : {}),
  });
}

export async function googleAuth(req: Request, res: Response) {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential token' });
    }

    const clientId = getGoogleClientId();

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid Google token: no email found' });
    }

    const googleEmail = payload.email.toLowerCase().trim();
    const googleName = payload.name || payload.email?.split('@')[0] || 'Google User';

    // Check if user already exists by email
    let user = await findUserByEmail(googleEmail);

    if (user) {
      // Existing user — link Google account (no password change needed)
      // No DB changes needed since we match by email
      // Ensure the role is correct
      const role = resolveUserRole(googleEmail, user.role);
      if (role !== user.role) {
        const { updateUserRole } = await import('../services/user.service');
        await updateUserRole(user.id, role);
        user.role = role;
      }
    } else {
      // New user — create account with Google email
      // Generate a random secure password since password_hash is NOT NULL
      // This user will only log in via Google, never via email/password
      const randomPassword = require('crypto').randomBytes(32).toString('hex');
      user = await createUser({
        name: googleName,
        email: googleEmail,
        password: randomPassword,
        role: resolveUserRole(googleEmail),
      });
    }

    // Issue the same JWT cookie as email/password login
    const token = signToken({ sub: user.id, role: user.role });
    setAuthCookie(res, token);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Google auth failed:', error);
    // Handle specific Google token verification errors
    if (error.message?.includes('Invalid token') || error.message?.includes('Token used too late')) {
      return res.status(401).json({ message: 'Google token is invalid or expired. Please try again.' });
    }
    return res.status(500).json({ message: 'Unable to authenticate with Google. Please try again.' });
  }
}

