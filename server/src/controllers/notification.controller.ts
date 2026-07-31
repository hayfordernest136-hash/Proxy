import { Request, Response } from 'express';
import { getNotificationsByUserId, markNotificationsRead } from '../services/notification.service';

export async function listNotificationsHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const notifications = await getNotificationsByUserId(userId);
    return res.json(notifications);
  } catch (error) {
    console.error('Failed to load notifications:', error);
    return res.status(500).json({ message: 'Unable to load notifications' });
  }
}

export async function markNotificationsReadHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    await markNotificationsRead(userId);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Failed to mark notifications read:', error);
    return res.status(500).json({ message: 'Unable to update notifications' });
  }
}
