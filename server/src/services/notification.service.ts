import { pool } from "../config/db";

export type NotificationRow = {
  id: number;
  user_id: number;
  order_id: number;
  title: string;
  body: string;
  is_read: number;
  created_at: string;
};

export async function getNotificationsByUserId(userId: number) {
  const [rows] = await pool.query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [userId],
  );
  return rows as NotificationRow[];
}

export async function markNotificationsRead(userId: number) {
  await pool.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [userId]);
}

export async function createNotification(
  userId: number,
  orderId: number,
  title: string,
  body: string,
) {
  await pool.query(
    "INSERT INTO notifications (user_id, order_id, title, body, is_read, created_at) VALUES (?, ?, ?, ?, 0, NOW())",
    [userId, orderId, title, body],
  );
}
