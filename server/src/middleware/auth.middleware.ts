import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ message: 'Not authenticated' });
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: 'Invalid token' });
  (req as any).userId = payload.sub;
  (req as any).role = payload.role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).role;
  if (role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  next();
}
