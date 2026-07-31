import { Request, Response } from 'express';
import { createOrderEvent, getAllOrders, getOrderById, updateOrder } from '../services/order.service';
import { createNotification } from '../services/notification.service';
import {
  getAdminDashboardStats,
  getAllUsersWithReferralStats,
  findUserById,
  updateUserRole,
} from '../services/user.service';

const STATUS_MESSAGE: Record<string, string> = {
  awaiting_payment: 'Order created, awaiting payment.',
  paid: 'Payment has been received successfully.',
  processing: 'We have received your order and are working on it.',
  purchasing_proxy: 'We are currently purchasing your proxy.',
  delivering: 'Your proxy is being delivered.',
  completed: 'Your order has been completed.',
  cancelled: 'Your order was cancelled.',
  refunded: 'Your order has been refunded.',
};

export async function getAdminOrdersHandler(_req: Request, res: Response) {
  try {
    const orders = await getAllOrders();
    return res.json(orders);
  } catch (error) {
    console.error('Failed to load admin orders:', error);
    return res.status(500).json({ message: 'Unable to load orders' });
  }
}

export async function getAdminDashboardHandler(_req: Request, res: Response) {
  try {
    const stats = await getAdminDashboardStats();
    return res.json(stats);
  } catch (error) {
    console.error('Failed to load admin dashboard stats:', error);
    return res.status(500).json({ message: 'Unable to load dashboard metrics' });
  }
}

export async function getAdminUsersHandler(_req: Request, res: Response) {
  try {
    const users = await getAllUsersWithReferralStats(50);
    return res.json(users);
  } catch (error) {
    console.error('Failed to load admin users:', error);
    return res.status(500).json({ message: 'Unable to load users' });
  }
}

export async function updateUserRoleHandler(_req: Request, res: Response) {
  return res.status(403).json({ message: 'Role changes are managed by the server configuration.' });
}

export async function updateOrderHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const { status, cd_key, admin_notes, refill_proof_url, delivery_status } = req.body;
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const statusValue = status as string | undefined;
    const shouldMarkUnread =
      statusValue &&
      order.status !== statusValue &&
      (statusValue === 'cancelled' || statusValue === 'refunded');

    const updatedOrder = await updateOrder(orderId, {
      status: statusValue,
      cd_key: cd_key === undefined ? undefined : cd_key || null,
      admin_notes: admin_notes === undefined ? undefined : admin_notes || null,
      refill_proof_url: refill_proof_url === undefined ? undefined : refill_proof_url || null,
      delivery_status: delivery_status === undefined ? undefined : delivery_status,
      support_message_unread: shouldMarkUnread ? 1 : undefined,
    });

    if (!updatedOrder) {
      return res.status(500).json({ message: 'Unable to update order' });
    }

    if (status) {
      await createOrderEvent(orderId, status, STATUS_MESSAGE[status] ?? 'Order status updated');
      await createNotification(
        order.user_id,
        order.id,
        `Order #${order.order_number} update`,
        `${order.product_name}: ${STATUS_MESSAGE[status] ?? 'Order status updated'}`,
      );
    }

    if (cd_key !== undefined && cd_key) {
      await createOrderEvent(orderId, 'cd_key_added', 'CD key added to order by admin');
    }

    if (refill_proof_url !== undefined && refill_proof_url) {
      await createOrderEvent(orderId, 'refill_proof_uploaded', 'Refill proof uploaded by admin');
    }

    if (admin_notes !== undefined && admin_notes) {
      await createOrderEvent(orderId, 'admin_note_added', 'Admin added an internal note');
      try {
        await createNotification(order.user_id, order.id, `Order #${order.order_number} update`, `A note was added to your order: ${String(admin_notes).slice(0,200)}`);
      } catch (e) {
        console.warn('Failed to create notification for admin note', e);
      }
    }

    if (delivery_status !== undefined) {
      await createOrderEvent(orderId, 'delivery_status_changed', `Delivery status: ${delivery_status}`);
    }

    return res.json({ ok: true, order: updatedOrder });
  } catch (error) {
    console.error('Failed to update order:', error);
    return res.status(500).json({ message: 'Unable to update order' });
  }
}
