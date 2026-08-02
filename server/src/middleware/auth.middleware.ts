import { Request, Response, NextFunction } from "express";
import { clearAuthCookie, getAuthToken, verifyToken } from "../utils/jwt";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getAuthToken(req);
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  const payload = verifyToken(token);
  if (!payload) {
    clearAuthCookie(res);
    return res.status(401).json({ message: "Invalid token" });
  }
  (req as any).userId = payload.sub;
  (req as any).role = payload.role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = String((req as any).role || "").toLowerCase();
  if (role !== "admin") return res.status(403).json({ message: "Forbidden" });
  next();
}
