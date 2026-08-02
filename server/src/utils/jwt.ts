import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

const EXPIRES_IN = "7d";

function getSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
}

export function signToken(payload: object) {
  return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, getSecret()) as any;
  } catch {
    return null;
  }
}

export function getAuthToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  const cookieToken = req.cookies?.token;
  if (typeof cookieToken === "string" && cookieToken.trim()) {
    return cookieToken;
  }

  return null;
}

export function getAuthCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  } as const;
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie("token", token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response) {
  res.clearCookie("token", {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  });
}
