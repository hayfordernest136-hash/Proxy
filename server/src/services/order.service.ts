import { pool } from '../config/db';

export type OrderRow = {
  id: number;
  order_number: number;
  user_id: number | null;
  product_id: number | null;
  plan_id: number | null;
  product_name: string;
  plan_name: string;
  proxy_type: string;
  quantity: number;
  unit_price: string;
  total_amount: string;
  payment_fee: string;
  payment_total_amount: string;
  currency: string;
  delivery_method: string;
  customer_email: string | null;
  customer_name: string | null;
  order_type: string | null;
  refill_email: string | null;
  refill_password: string | null;
  refill_notes: string | null;
  status: string;
  payment_status: string;
  support_message_unread: number;
  payment_reference: string | null;
  payment_provider: string | null;
  referral_discount_applied: number;
  cd_key: string | null;
  admin_notes: string | null;
  refill_proof_url: string | null;
  delivery_status: string | null;
  fulfillment_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderEventRow = {
  id: number;
  order_id: number;
  status: string;
  message: string;
  created_at: string;
};

export async function getNextOrderNumber(connection?: any) {
  const query = 'SELECT COALESCE(MAX(order_number), 100000) + 1 AS next_order_number FROM orders';
  const [rows] = connection
    ? await connection.query(query)
    : await pool.query(query);
  const next = (rows as any[])[0]?.next_order_number;
  return Number(next) || 100001;
}

export async function createOrder(order: {
  user_id?: number | null;
  product_id?: number | null;
  plan_id?: number | null;
  product_name: string;
  plan_name: string;
  proxy_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  delivery_method: string;
  customer_email?: string | null;
  customer_name?: string | null;
  order_type?: string | null;
  refill_email?: string | null;
  refill_password?: string | null;
  refill_notes?: string | null;
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const order_number = await getNextOrderNumber(connection);
    const paymentFee = 0;
    const paymentTotalAmount = Number(order.total_amount);
    const orderType = order.order_type?.trim() || (order.delivery_method === 'data_bundle' ? 'data' : 'proxy');
    const [result] = await connection.query(
      `INSERT INTO orders
        (order_number, user_id, product_id, plan_id, product_name, plan_name, proxy_type, quantity, unit_price, total_amount, payment_fee, payment_total_amount, currency, delivery_method, customer_email, customer_name, order_type, refill_email, refill_password, refill_notes, status, payment_status, support_message_unread, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        order_number,
        order.user_id ?? null,
        order.product_id ?? null,
        order.plan_id ?? null,
        order.product_name,
        order.plan_name,
        order.proxy_type,
        order.quantity,
        order.unit_price,
        order.total_amount,
        paymentFee,
        paymentTotalAmount,
        order.currency,
        order.delivery_method,
        order.customer_email ?? null,
        order.customer_name ?? null,
        orderType,
        order.refill_email ?? null,
        order.refill_password ?? null,
        order.refill_notes ?? null,
        'awaiting_payment',
        'unpaid',
        0,
      ],
    );

    const insertId = (result as any).insertId;
    await connection.query(
      'INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, ?, ?, NOW())',
      [insertId, 'awaiting_payment', 'Order placed and waiting for payment.'],
    );

    await connection.commit();

    const [rows] = await connection.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [insertId]);
    return (rows as OrderRow[])[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function markOrderPaid(orderId: number, reference: string, provider: string) {
  const [result] = await pool.query(
    `UPDATE orders
     SET payment_status = 'paid', status = 'paid', payment_reference = ?, payment_provider = ?, updated_at = NOW()
     WHERE id = ? AND payment_status != 'paid'`,
    [reference, provider, orderId],
  );
  return (result as any).affectedRows > 0;
}

export async function markOrderFailed(orderId: number, reference: string, provider: string) {
  const [result] = await pool.query(
    `UPDATE orders
     SET payment_status = 'failed', status = 'failed', payment_reference = ?, payment_provider = ?, updated_at = NOW()
     WHERE id = ? AND payment_status != 'paid'`,
    [reference, provider, orderId],
  );
  return (result as any).affectedRows > 0;
}

export async function setOrderPaymentFee(orderId: number, paymentFee: number, paymentTotalAmount: number) {
  await pool.query(
    'UPDATE orders SET payment_fee = ?, payment_total_amount = ?, updated_at = NOW() WHERE id = ?',
    [paymentFee, paymentTotalAmount, orderId],
  );
}

export async function markSupportMessageRead(orderId: number, userId: number) {
  const order = await getOrderById(orderId);
  if (!order || order.user_id !== userId) return null;
  await pool.query(
    'UPDATE orders SET support_message_unread = 0, updated_at = NOW() WHERE id = ?',
    [orderId],
  );
  return getOrderById(orderId);
}

export async function getOrderById(orderId: number) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [orderId]);
  return (rows as OrderRow[])[0] ?? null;
}

export async function getOrderByFulfillmentReference(reference: string) {
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE fulfillment_reference = ? LIMIT 1',
    [reference],
  );
  return (rows as OrderRow[])[0] ?? null;
}

export async function getOrdersByUserId(userId: number) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows as OrderRow[];
}

export async function applyReferralDiscountToOrder(orderId: number, userId: number) {
  const order = await getOrderById(orderId);
  if (!order || order.user_id !== userId) return null;
  if (order.payment_status === 'paid') return null;
  if (order.referral_discount_applied) return null;
  if (order.quantity !== 10) return null;

  const [rows] = await pool.query(
    'SELECT referral_reward_used_at FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const user = (rows as any[])[0];
  if (!user || user.referral_reward_used_at) return null;

  const totalAmount = Number(order.total_amount);
  const discountedAmount = Number((totalAmount / 2).toFixed(2));

  await pool.query(
    'UPDATE orders SET total_amount = ?, payment_total_amount = ?, referral_discount_applied = 1, updated_at = NOW() WHERE id = ?',
    [discountedAmount, discountedAmount, orderId],
  );

  await pool.query('UPDATE users SET referral_reward_used_at = NOW() WHERE id = ?', [userId]);

  return getOrderById(orderId);
}

export async function getAllOrders() {
  const [rows] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  return rows as OrderRow[];
}

export async function updateOrder(orderId: number, patch: Partial<Pick<OrderRow, 'status' | 'cd_key' | 'admin_notes' | 'refill_proof_url' | 'delivery_status' | 'support_message_unread' | 'fulfillment_reference'>>) {
  const fields = [] as string[];
  const params = [] as any[];

  if (patch.status !== undefined) {
    fields.push('status = ?');
    params.push(patch.status);
  }
  if (patch.cd_key !== undefined) {
    fields.push('cd_key = ?');
    params.push(patch.cd_key);
  }
  if (patch.admin_notes !== undefined) {
    fields.push('admin_notes = ?');
    params.push(patch.admin_notes);
  }
  if ((patch as any).refill_proof_url !== undefined) {
    fields.push('refill_proof_url = ?');
    params.push((patch as any).refill_proof_url);
  }
  if ((patch as any).delivery_status !== undefined) {
    fields.push('delivery_status = ?');
    params.push((patch as any).delivery_status);
  }

  if ((patch as any).support_message_unread !== undefined) {
    fields.push('support_message_unread = ?');
    params.push((patch as any).support_message_unread);
  }

  if ((patch as any).fulfillment_reference !== undefined) {
    fields.push('fulfillment_reference = ?');
    params.push((patch as any).fulfillment_reference);
  }

  if (fields.length === 0) {
    return await getOrderById(orderId);
  }

  params.push(orderId);
  await pool.query(
    `UPDATE orders SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
    params,
  );

  return getOrderById(orderId);
}

export async function createOrderEvent(orderId: number, status: string, message: string) {
  const [rows] = await pool.query(
    'INSERT INTO order_events (order_id, status, message, created_at) VALUES (?, ?, ?, NOW())',
    [orderId, status, message],
  );
  return rows as any;
}

export async function getOrderEvents(orderId: number) {
  const [rows] = await pool.query('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at ASC', [orderId]);
  return rows as OrderEventRow[];
}
