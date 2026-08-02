import {
  getAdminBusinessEmail,
  getAdminNotificationEmail,
  getPaymentEmail,
  getSupportEmail,
  sendEmail,
} from "./email.service";
import {
  formatOrderReference,
  renderAdminNotificationEmail,
  renderOrderCompletedEmail,
  renderOrderIssueEmail,
  renderOrderReceivedEmail,
  renderPaymentConfirmedEmail,
  type AdminAlertContext,
  type AdminAlertEvent,
} from "./email-templates";
import type { OrderRow } from "./order.service";
import { getProductById } from "./product.service";

/**
 * High-level email triggers for both Proxy and Data orders.
 *
 * - Detects order type automatically.
 * - Uses the customer email from the order (checkout email for guests,
 *   account email for registered users).
 * - Every function is safe: email failures are logged and never thrown.
 */

export function isDataOrder(order: Pick<OrderRow, "delivery_method" | "product_name">): boolean {
  return (
    order.delivery_method === "data_bundle" ||
    String(order.product_name || "")
      .toLowerCase()
      .includes("data")
  );
}

export function getOrderCustomerName(order: OrderRow): string {
  if (order.customer_name) return String(order.customer_name).trim();

  // Fall back to metadata stored in refill_notes for guest data orders.
  try {
    const meta = order.refill_notes ? JSON.parse(order.refill_notes) : {};
    return String(meta.customer_name || meta.full_name || "").trim();
  } catch {
    return "";
  }
}

export function getOrderCustomerEmail(order: OrderRow): string {
  if (order.customer_email) return String(order.customer_email).trim();
  if (order.refill_email) return String(order.refill_email).trim();

  try {
    const meta = order.refill_notes ? JSON.parse(order.refill_notes) : {};
    return String(meta.email || meta.customer_email || "").trim();
  } catch {
    return "";
  }
}

function getDataDeliveryNumber(order: OrderRow): string {
  try {
    const meta = order.refill_notes ? JSON.parse(order.refill_notes) : {};
    const single = String(meta.delivery_number || meta.deliveryNumber || "").trim();
    if (single) return single;
    const numbers = Array.isArray(meta.delivery_numbers)
      ? meta.delivery_numbers.filter(Boolean).join(", ")
      : "";
    if (numbers) return numbers;
  } catch {
    // ignore
  }
  return String(order.refill_password || "").trim();
}

function getDataBundle(order: OrderRow): string {
  try {
    const meta = order.refill_notes ? JSON.parse(order.refill_notes) : {};
    const bundle = String(meta.bundle || "").trim();
    if (bundle) return bundle;
  } catch {
    // ignore
  }
  return String(order.plan_name || "Data bundle").trim();
}

function getDataNetwork(order: OrderRow): string {
  try {
    const meta = order.refill_notes ? JSON.parse(order.refill_notes) : {};
    const network = String(meta.network || "").trim();
    if (network) return network;
  } catch {
    // ignore
  }
  return String(order.proxy_type || "Data").trim();
}

function formatMoneyValue(value: unknown, currency?: string) {
  const amount = Number(value || 0);
  const symbol = currency === "USD" ? "$" : "GH₵";
  if (!Number.isFinite(amount)) return String(value ?? "—");
  return `${symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type OrderEmailContext = {
  orderId: string;
  customerName: string;
  orderDate: string;
  productType: "Proxy" | "Data";
  rows: { label: string; value: string }[];
};

function buildDataRows(
  order: OrderRow,
  extra?: { amount?: string; status?: string; completion?: string },
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Network", value: getDataNetwork(order) },
    { label: "Data bundle", value: getDataBundle(order) },
    { label: "Delivery number", value: getDataDeliveryNumber(order) },
  ];

  if (extra?.status) rows.push({ label: "Status", value: extra.status });
  if (extra?.completion) rows.push({ label: "Completion", value: extra.completion });

  const amount = extra?.amount ?? formatMoneyValue(order.total_amount, order.currency);
  rows.push({ label: "Amount paid", value: amount });

  return rows;
}

function buildProxyRows(
  order: OrderRow,
  product?: { location?: string | null; name?: string | null } | null,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: "Proxy type", value: String(order.proxy_type || "Proxy").trim() },
    { label: "Location", value: String(product?.location || "Global").trim() },
    {
      label: "Plan",
      value: String(order.plan_name || product?.name || "—").trim(),
    },
    { label: "Quantity", value: `${order.quantity} ${order.quantity === 1 ? "IP" : "IPs"}` },
    { label: "Amount paid", value: formatMoneyValue(order.total_amount, order.currency) },
  ];

  return rows;
}

function buildBaseContext(order: OrderRow): OrderEmailContext {
  return {
    orderId: formatOrderReference(order.order_number),
    customerName: getOrderCustomerName(order),
    orderDate: order.created_at,
    productType: isDataOrder(order) ? "Data" : "Proxy",
    rows: [],
  };
}

/**
 * 1. Order Received — fires right after the order is created.
 * Sent from payment@brokeflexdata.com.
 */
export async function sendOrderReceivedEmail(order: OrderRow): Promise<void> {
  const email = getOrderCustomerEmail(order);
  if (!email) return;

  const base = buildBaseContext(order);
  const product = isDataOrder(order)
    ? null
    : await getProductById(Number(order.product_id)).catch(() => null);

  base.rows = isDataOrder(order) ? buildDataRows(order) : buildProxyRows(order, product);

  const html = renderOrderReceivedEmail({
    orderId: base.orderId,
    customerName: base.customerName,
    orderDate: base.orderDate,
    productType: base.productType,
    rows: base.rows,
  });

  await sendEmail(
    { to: email, subject: `Order Received — ${base.orderId}`, html, from: getPaymentEmail() },
    { emailType: "order_received", orderId: order.id },
  );
}

/**
 * 2. Payment Confirmed — fires after Paystack confirms the charge.
 * Sent from payment@brokeflexdata.com.
 */
export async function sendPaymentConfirmedEmail(
  order: OrderRow,
  paymentReference: string,
): Promise<void> {
  const email = getOrderCustomerEmail(order);
  if (!email) return;

  const base = buildBaseContext(order);
  const product = isDataOrder(order)
    ? null
    : await getProductById(Number(order.product_id)).catch(() => null);

  base.rows = [
    { label: "Order ID", value: base.orderId },
    { label: "Payment reference", value: String(paymentReference || "—") },
    { label: "Payment method", value: String(order.payment_provider || "Paystack").trim() },
    ...(isDataOrder(order)
      ? buildDataRows(order, {
          amount: formatMoneyValue(
            order.payment_total_amount || order.total_amount,
            order.currency,
          ),
        })
      : buildProxyRows(order, product)),
  ];

  const html = renderPaymentConfirmedEmail({
    orderId: base.orderId,
    customerName: base.customerName,
    orderDate: base.orderDate,
    productType: base.productType,
    rows: base.rows,
  });

  await sendEmail(
    { to: email, subject: `Payment Confirmed — ${base.orderId}`, html, from: getPaymentEmail() },
    { emailType: "payment_confirmed", orderId: order.id },
  );
}

/**
 * 3. Order Completed — only after successful fulfillment.
 * Proxy credentials / CD key are included ONLY at this stage.
 * Sent from payment@brokeflexdata.com.
 */
export async function sendOrderCompletedEmail(order: OrderRow): Promise<void> {
  const email = getOrderCustomerEmail(order);
  if (!email) return;

  const base = buildBaseContext(order);
  const product = isDataOrder(order)
    ? null
    : await getProductById(Number(order.product_id)).catch(() => null);

  if (isDataOrder(order)) {
    base.rows = buildDataRows(order, {
      status: "Completed",
      completion: order.delivery_status === "delivered" ? "Delivered successfully" : "Completed",
      amount: formatMoneyValue(order.total_amount, order.currency),
    });
  } else {
    base.rows = buildProxyRows(order, product);

    // Only send sensitive credentials after successful completion.
    if (order.cd_key) {
      base.rows.push({ label: "CD Key", value: order.cd_key });
    }
    if (order.refill_email) {
      base.rows.push({ label: "Account", value: order.refill_email });
    }
    if (order.refill_password && order.status === "completed") {
      base.rows.push({ label: "Account password", value: order.refill_password });
    }
  }

  const html = renderOrderCompletedEmail({
    orderId: base.orderId,
    customerName: base.customerName,
    orderDate: base.orderDate,
    productType: base.productType,
    rows: base.rows,
  });

  await sendEmail(
    { to: email, subject: `Order Completed — ${base.orderId}`, html, from: getPaymentEmail() },
    { emailType: "order_completed", orderId: order.id },
  );
}

/**
 * 4. Order Issue — fired when an order fails, is cancelled, or refunded.
 * Sent from support@brokeflexdata.com.
 */
export async function sendOrderIssueEmail(order: OrderRow, problem: string): Promise<void> {
  const email = getOrderCustomerEmail(order);
  if (!email) return;

  const base = buildBaseContext(order);
  const product = isDataOrder(order)
    ? null
    : await getProductById(Number(order.product_id)).catch(() => null);

  base.rows = [
    { label: "Order ID", value: base.orderId },
    {
      label: "Current status",
      value: String(order.status || "failed")
        .replace(/_/g, " ")
        .toUpperCase(),
    },
    { label: "Support contact", value: getSupportEmail() },
    ...(isDataOrder(order) ? buildDataRows(order) : buildProxyRows(order, product)),
  ];

  const html = renderOrderIssueEmail({
    orderId: base.orderId,
    customerName: base.customerName,
    orderDate: base.orderDate,
    productType: base.productType,
    rows: base.rows,
    statusLabel: String(order.status || "failed")
      .replace(/_/g, " ")
      .toUpperCase(),
    problem: problem || "We encountered an issue with your order.",
  });

  await sendEmail(
    {
      to: email,
      subject: `Order Issue — ${base.orderId}`,
      html,
      from: getSupportEmail(),
    },
    { emailType: "order_issue", orderId: order.id },
  );
}

/**
 * 5. Admin Alert — internal notification to the operations team.
 * Sent from admin@brokeflexdata.com to ADMIN_NOTIFICATION_EMAIL.
 * Uses the distinct Admin Alert template with status color indicators.
 */
export async function sendAdminAlertEmail(
  order: OrderRow,
  event: AdminAlertEvent,
  extra?: {
    errorMessage?: string;
    details?: string[];
  },
): Promise<void> {
  const recipient = getAdminNotificationEmail();
  // No ADMIN_NOTIFICATION_EMAIL configured — skip silently (admin alerts are opt-in).
  if (!recipient) return;

  const base = buildBaseContext(order);
  const product = isDataOrder(order)
    ? null
    : await getProductById(Number(order.product_id)).catch(() => null);

  const productDetails = isDataOrder(order)
    ? `${getDataNetwork(order)} • ${getDataBundle(order)} • ${getDataDeliveryNumber(order)}`
    : `${String(order.proxy_type || "Proxy").trim()} • ${String(
        order.plan_name || product?.name || "—",
      ).trim()} • ${order.quantity} IP`;

  const paymentStatus =
    order.payment_status === "paid"
      ? "PAID"
      : order.payment_status === "failed"
        ? "FAILED"
        : String(order.payment_status || "pending")
            .replace(/_/g, " ")
            .toUpperCase();

  const fulfillmentStatus = String(
    order.delivery_status === "delivered"
      ? "Delivered"
      : order.status === "completed"
        ? "Completed"
        : order.delivery_status || order.status || "pending",
  )
    .replace(/_/g, " ")
    .toUpperCase();

  const context: AdminAlertContext = {
    event,
    orderId: base.orderId,
    customerName: base.customerName,
    customerEmail: getOrderCustomerEmail(order),
    productType: base.productType,
    productDetails,
    amount: formatMoneyValue(order.total_amount, order.currency),
    currency: String(order.currency || "GHS").toUpperCase(),
    paymentStatus,
    fulfillmentStatus,
    details: extra?.details,
    errorMessage: extra?.errorMessage,
    eventTime: new Date().toISOString(),
  };

  const html = renderAdminNotificationEmail(context);

  const eventLabels: Record<AdminAlertEvent, string> = {
    new_order: "New Order",
    payment_success: "Payment Success",
    payment_failed: "Payment Failed",
    data_delivery_success: "Data Delivery Success",
    data_delivery_failed: "Data Delivery Failed",
    proxy_fulfillment_completed: "Proxy Fulfillment Completed",
    proxy_fulfillment_failed: "Proxy Fulfillment Failed",
  };

  await sendEmail(
    {
      to: recipient,
      subject: `[Admin Alert] ${eventLabels[event]} — ${base.orderId}`,
      html,
      from: getAdminBusinessEmail(),
    },
    { emailType: "admin_alert", orderId: order.id },
  );
}
