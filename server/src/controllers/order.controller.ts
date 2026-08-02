import { Request, Response } from "express";
import {
  applyReferralDiscountToOrder,
  createOrder,
  getOrderById,
  getOrdersByUserId,
  getOrderEvents,
  markSupportMessageRead,
} from "../services/order.service";
import { sendAdminAlertEmail, sendOrderReceivedEmail } from "../services/order-email.service";

type OrderRow = Awaited<ReturnType<typeof getOrderById>>;

function sanitizeOrderForCustomer(order: any) {
  if (!order) return null;
  const {
    refill_password,
    payment_reference,
    payment_provider,
    customer_email,
    customer_name,
    order_type,
    ...publicOrder
  } = order;
  return publicOrder;
}

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
      account_type,
    } = req.body;

    // Basic validation: account refill requires account type and password
    if (delivery_method === "account_refill") {
      if (!account_type || !["new", "existing"].includes(String(account_type))) {
        return res
          .status(400)
          .json({ message: "Missing or invalid account_type for account refill" });
      }
      if (!refill_password || String(refill_password).trim().length === 0) {
        return res.status(400).json({ message: "Password is required for account refill" });
      }
    }

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
    });

    // Notify the customer the order was received and alert the admin team.
    const createdOrder = await getOrderById(order.id);
    if (createdOrder) {
      await sendOrderReceivedEmail(createdOrder);
      await sendAdminAlertEmail(createdOrder, "new_order");
    }

    return res.status(201).json(sanitizeOrderForCustomer(order));
  } catch (error) {
    console.error("Failed to create order:", error);
    return res.status(500).json({ message: "Unable to create order" });
  }
}

export async function getOrderHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(sanitizeOrderForCustomer(order));
  } catch (error) {
    console.error("Failed to load order:", error);
    return res.status(500).json({ message: "Unable to load order" });
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
        return res.status(400).json({ message: "Referral discount cannot be applied" });
      }
      return res.json(sanitizeOrderForCustomer(order));
    }

    return res.status(400).json({ message: "No valid update provided" });
  } catch (error: any) {
    console.error("Failed to update order:", error);
    return res.status(500).json({ message: error.message || "Unable to update order" });
  }
}

export async function getUserOrdersHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const orders = await getOrdersByUserId(userId);
    return res.json(orders.map(sanitizeOrderForCustomer));
  } catch (error) {
    console.error("Failed to load user orders:", error);
    return res.status(500).json({ message: "Unable to load orders" });
  }
}

export async function getOrderEventsHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const events = await getOrderEvents(orderId);
    return res.json(events);
  } catch (error) {
    console.error("Failed to load order events:", error);
    return res.status(500).json({ message: "Unable to load order events" });
  }
}

export async function markSupportMessageReadHandler(req: Request, res: Response) {
  try {
    const userId = Number((req as any).userId);
    const orderId = Number(req.params.orderId);
    if (!orderId) {
      return res.status(400).json({ message: "Missing order id" });
    }

    const order = await markSupportMessageRead(orderId, userId);
    if (!order) {
      return res.status(404).json({ message: "Order not found or not owned by user" });
    }

    return res.json({ ok: true, order: sanitizeOrderForCustomer(order) });
  } catch (error) {
    console.error("Failed to mark support message read:", error);
    return res.status(500).json({ message: "Unable to mark support message read" });
  }
}
