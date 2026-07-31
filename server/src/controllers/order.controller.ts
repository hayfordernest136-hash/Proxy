import { Request, Response } from 'express';
import {
  applyReferralDiscountToOrder,
  createOrder,
  getOrderById,
  getOrdersByUserId,
  getOrderEvents,
  markSupportMessageRead,
} from '../services/order.service';

export async function createOrderHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const {
      product_id,
      plan_id,
      product_name,
      plan_name,
      proxy_type,
      quantity,
      unit_price,
      total_amount,
      currency,
      delivery_method,
      refill_email,
      refill_password,
      refill_notes,
    } = req.body;

    const order = await createOrder({
      user_id: userId,
      product_id: Number(product_id),
      plan_id: Number(plan_id),
      product_name,
      plan_name,
      proxy_type,
      quantity: Number(quantity),
      unit_price: Number(unit_price),
      total_amount: Number(total_amount),
      currency,
      delivery_method,
      refill_email: refill_email ? String(refill_email).slice(0, 255) : null,
      refill_password: refill_password ? String(refill_password).slice(0, 255) : null,
      refill_notes: refill_notes ? String(refill_notes).slice(0, 1000) : null,
    });

    return res.status(201).json(order);
  } catch (error) {
    console.error('Failed to create order:', error);
    return res.status(500).json({ message: 'Unable to create order' });
  }
}

export async function getOrderHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (error) {
    console.error('Failed to load order:', error);
    return res.status(500).json({ message: 'Unable to load order' });
  }
}

export async function updateOrderHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const orderId = Number(req.params.orderId);
    const { apply_referral_discount } = req.body;

    if (apply_referral_discount) {
      const order = await applyReferralDiscountToOrder(orderId, userId);
      if (!order) {
        return res.status(400).json({ message: 'Referral discount cannot be applied' });
      }
      return res.json(order);
    }

    return res.status(400).json({ message: 'No valid update provided' });
  } catch (error: any) {
    console.error('Failed to update order:', error);
    return res.status(500).json({ message: error.message || 'Unable to update order' });
  }
}

export async function getUserOrdersHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const orders = await getOrdersByUserId(userId);
    return res.json(orders);
  } catch (error) {
    console.error('Failed to load user orders:', error);
    return res.status(500).json({ message: 'Unable to load orders' });
  }
}

export async function getOrderEventsHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const events = await getOrderEvents(orderId);
    return res.json(events);
  } catch (error) {
    console.error('Failed to load order events:', error);
    return res.status(500).json({ message: 'Unable to load order events' });
  }
}

export async function markSupportMessageReadHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const orderId = Number(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ message: 'Missing order id' });
    }

    const order = await markSupportMessageRead(orderId, userId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found or not owned by user' });
    }

    return res.json({ ok: true, order });
  } catch (error) {
    console.error('Failed to mark support message read:', error);
    return res.status(500).json({ message: 'Unable to mark support message read' });
  }
}
