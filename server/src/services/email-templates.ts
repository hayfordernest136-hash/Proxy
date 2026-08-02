import { getSupportEmail } from "./email.service";

/**
 * Reusable HTML email templates shared by both Proxy and Data orders.
 * A single layout renders an order summary with type-specific rows.
 */

export type OrderEmailContext = {
  siteName: string;
  orderId: string; // BRK-XXX-XXX
  customerName: string;
  orderDate: string;
  productType: "Proxy" | "Data";
  statusLabel: string;
  rows: { label: string; value: string }[];
  message: string;
};

const SITE_NAME = "BrokeFlex";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | Date | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatOrderReference(orderNumber: number) {
  const digits = String(orderNumber).padStart(6, "0");
  return `BRK-${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function renderStatusBadge(statusLabel: string) {
  return `
    <span style="display:inline-block;background:#FACC15;color:#111827;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding:6px 14px;border-radius:999px;">
      ${escapeHtml(statusLabel)}
    </span>
  `;
}

function renderRows(rows: { label: string; value: string }[]) {
  if (!rows.length) return "";
  return rows
    .map(
      (row) => `
        <tr>
          <td style="padding:8px 16px;color:#6B7280;font-size:14px;">${escapeHtml(row.label)}</td>
          <td style="padding:8px 16px;color:#111827;font-weight:600;font-size:14px;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
    .join("");
}

export function renderOrderEmail(context: OrderEmailContext): string {
  const { orderId, customerName, orderDate, productType, statusLabel, rows, message } = context;

  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F3F4F6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
            <!-- Header -->
            <tr>
              <td style="background:#111827;padding:28px 32px;">
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em;">
                  Broke<span style="color:#FACC15;">Flex</span>
                </div>
                <div style="margin-top:4px;font-size:13px;color:#9CA3AF;">Order notification</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <div style="font-size:14px;color:#6B7280;">${customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,"}</div>

                <div style="margin-top:20px;font-size:18px;font-weight:800;color:#111827;">${escapeHtml(message)}</div>

                <div style="margin-top:12px;">${renderStatusBadge(statusLabel)}</div>

                <!-- Order meta -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 16px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Order ID</span>
                      <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(orderId)}</div>
                    </td>
                    <td style="padding:14px 16px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;border-left:1px solid #E5E7EB;">
                      <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Order date</span>
                      <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(formatDate(orderDate))}</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 16px;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Product type</span>
                      <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(productType)}</div>
                    </td>
                    <td style="padding:14px 16px;border-bottom:1px solid #E5E7EB;border-left:1px solid #E5E7EB;">
                      <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Status</span>
                      <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(statusLabel)}</div>
                    </td>
                  </tr>
                </table>

                <!-- Order details -->
                ${
                  rows.length
                    ? `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                        <tr>
                          <td style="padding:14px 16px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
                            <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Order summary</span>
                          </td>
                        </tr>
                        ${renderRows(rows)}
                      </table>
                    `
                    : ""
                }

                <!-- Support -->
                <div style="margin-top:28px;padding:16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
                  <div style="font-size:14px;font-weight:700;color:#111827;">Need help?</div>
                  <div style="margin-top:4px;font-size:13px;color:#6B7280;">
                    Contact our support team at
                    <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#FACC15;font-weight:700;text-decoration:none;">${escapeHtml(getSupportEmail())}</a>
                    or visit the Support page on ${escapeHtml(SITE_NAME)}.
                  </div>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
                <div style="font-size:12px;color:#9CA3AF;text-align:center;">
                  © ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}. All rights reserved.<br/>
                  This is an automated message about your order ${escapeHtml(orderId)}.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

/**
 * Order Received — shown while awaiting payment.
 */
export function renderOrderReceivedEmail(input: {
  orderId: string;
  customerName: string;
  orderDate: string;
  productType: "Proxy" | "Data";
  rows: { label: string; value: string }[];
}): string {
  return renderOrderEmail({
    ...input,
    siteName: SITE_NAME,
    statusLabel: "Pending Payment",
    message: "We received your order — it is awaiting payment.",
  });
}

/**
 * Payment Confirmed — sent immediately after Paystack confirms a charge.
 */
export function renderPaymentConfirmedEmail(input: {
  orderId: string;
  customerName: string;
  orderDate: string;
  productType: "Proxy" | "Data";
  rows: { label: string; value: string }[];
}): string {
  return renderOrderEmail({
    ...input,
    siteName: SITE_NAME,
    statusLabel: "Processing Delivery",
    message: "Payment confirmed — your order is now being processed.",
  });
}

/**
 * Order Completed — only sent after successful fulfillment.
 */
export function renderOrderCompletedEmail(input: {
  orderId: string;
  customerName: string;
  orderDate: string;
  productType: "Proxy" | "Data";
  rows: { label: string; value: string }[];
}): string {
  return renderOrderEmail({
    ...input,
    siteName: SITE_NAME,
    statusLabel: "Completed",
    message: "Your order has been completed successfully.",
  });
}

/**
 * Order Issue — sent when an order fails or is cancelled/refunded.
 */
export function renderOrderIssueEmail(input: {
  orderId: string;
  customerName: string;
  orderDate: string;
  productType: "Proxy" | "Data";
  rows: { label: string; value: string }[];
  statusLabel: string;
  problem: string;
}): string {
  return renderOrderEmail({
    ...input,
    siteName: SITE_NAME,
    statusLabel: input.statusLabel,
    message: input.problem,
  });
}

export type AdminAlertEvent =
  | "new_order"
  | "payment_success"
  | "payment_failed"
  | "data_delivery_success"
  | "data_delivery_failed"
  | "proxy_fulfillment_completed"
  | "proxy_fulfillment_failed";

export type AdminAlertContext = {
  event: AdminAlertEvent;
  orderId: string; // BRK-XXX-XXX
  customerName: string;
  customerEmail: string;
  productType: "Proxy" | "Data";
  productDetails: string;
  amount: string;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  details?: string[];
  errorMessage?: string;
  eventTime: string;
};

const ADMIN_EVENT_META: Record<
  AdminAlertEvent,
  { label: string; color: string; description: string }
> = {
  new_order: { label: "New Order", color: "#3B82F6", description: "A new order has been placed." },
  payment_success: {
    label: "Payment Success",
    color: "#10B981",
    description: "A payment was confirmed successfully.",
  },
  payment_failed: {
    label: "Payment Failed",
    color: "#EF4444",
    description: "A payment could not be verified.",
  },
  data_delivery_success: {
    label: "Data Delivery Success",
    color: "#10B981",
    description: "A data order was fulfilled successfully.",
  },
  data_delivery_failed: {
    label: "Data Delivery Failed",
    color: "#EF4444",
    description: "A data order could not be fulfilled.",
  },
  proxy_fulfillment_completed: {
    label: "Proxy Fulfillment Completed",
    color: "#10B981",
    description: "A proxy order was marked as completed.",
  },
  proxy_fulfillment_failed: {
    label: "Proxy Fulfillment Failed",
    color: "#EF4444",
    description: "A proxy order failed or was cancelled.",
  },
};

function renderStatusPill(label: string, status: "success" | "failed" | "pending") {
  const color = status === "success" ? "#10B981" : status === "failed" ? "#EF4444" : "#F59E0B";

  return `
    <span style="display:inline-flex;align-items:center;gap:6px;background:${color}20;color:${color};font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding:8px 14px;border-radius:999px;border:1px solid ${color}40;">
      ${escapeHtml(label)}
    </span>
  `;
}

function renderAdminRows(rows: { label: string; value: string }[]) {
  return rows
    .map(
      (row, index) => `
        <tr style="background:${index % 2 === 0 ? "#FFFFFF" : "#F8FAFC"};">
          <td style="padding:12px 16px;color:#475569;font-size:14px;font-weight:600;">${escapeHtml(row.label)}</td>
          <td style="padding:12px 16px;color:#0F172A;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
    .join("");
}

/**
 * Admin Alert — internal notification template for the operations team.
 * Distinct design with status color indicators and detailed event context.
 */
/**
 * Welcome — sent immediately after a new account is created.
 * Always sent from support@brokeflexdata.com (account-related email).
 */
export function renderWelcomeEmail(input: {
  customerName: string;
  email: string;
  loginUrl: string;
}): string {
  const { customerName, email, loginUrl } = input;
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F3F4F6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
            <!-- Header -->
            <tr>
              <td style="background:#111827;padding:28px 32px;">
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em;">
                  Broke<span style="color:#FACC15;">Flex</span>
                </div>
                <div style="margin-top:4px;font-size:13px;color:#9CA3AF;">Welcome to your account</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <div style="font-size:14px;color:#6B7280;">${customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,"}</div>

                <div style="margin-top:20px;font-size:18px;font-weight:800;color:#111827;">
                  Your BrokeFlex account has been created successfully.
                </div>

                <div style="margin-top:12px;font-size:14px;line-height:1.7;color:#374151;">
                  You can now sign in to buy data bundles, purchase proxy plans, track orders,
                  and manage your account. No email verification is required.
                </div>

                <!-- Account details -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:14px 16px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;">
                      <span style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Registered email</span>
                      <div style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(email)}</div>
                    </td>
                  </tr>
                </table>

                <!-- CTA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#FACC15;color:#111827;font-weight:700;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px;">
                        Log in to your account
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:24px;padding:16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;">
                  <div style="font-size:14px;font-weight:700;color:#111827;">Need help?</div>
                  <div style="margin-top:4px;font-size:13px;color:#6B7280;">
                    Contact our support team at
                    <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#FACC15;font-weight:700;text-decoration:none;">${escapeHtml(getSupportEmail())}</a>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
                <div style="font-size:12px;color:#9CA3AF;text-align:center;">
                  © ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}. All rights reserved.<br/>
                  This is an automated message about your account registration.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export function renderLoginNotificationEmail(input: { customerName: string }): string {
  const { customerName } = input;
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F3F4F6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
            <!-- Header -->
            <tr>
              <td style="background:#111827;padding:28px 32px;">
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em;">
                  Broke<span style="color:#FACC15;">Flex</span>
                </div>
                <div style="margin-top:4px;font-size:13px;color:#9CA3AF;">Login notification</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <div style="font-size:14px;color:#6B7280;">${customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,"}</div>

                <div style="margin-top:20px;font-size:18px;font-weight:800;color:#111827;">
                  You just signed in to your BrokeFlex account.
                </div>

                <div style="margin-top:12px;font-size:14px;line-height:1.7;color:#374151;">
                  If this was you, no further action is needed. If you did not sign in, please reset your password or contact support immediately.
                </div>

                <div style="margin-top:24px;padding:16px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;color:#475569;font-size:14px;">
                  This email is for your security. You can safely ignore it if you signed in recently.
                </div>

                <div style="margin-top:24px;font-size:12px;color:#9CA3AF;line-height:1.6;">
                  Need help? Contact us at ${escapeHtml(getSupportEmail())}.
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
                <div style="font-size:12px;color:#9CA3AF;text-align:center;">
                  © ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}. All rights reserved.<br/>
                  This is an automated security notification.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

/**
 * Password Reset — sent when a user requests a password reset.
 * Always sent from support@brokeflexdata.com (account-related email).
 * Includes a single-use reset link, expiration time, and a security notice.
 */
export function renderPasswordResetEmail(input: {
  customerName: string;
  email: string;
  resetUrl: string;
  expiresAt: string;
}): string {
  const { customerName, email, resetUrl, expiresAt } = input;
  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F3F4F6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;border:1px solid #E5E7EB;">
            <!-- Header -->
            <tr>
              <td style="background:#111827;padding:28px 32px;">
                <div style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em;">
                  Broke<span style="color:#FACC15;">Flex</span>
                </div>
                <div style="margin-top:4px;font-size:13px;color:#9CA3AF;">Password reset request</div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <div style="font-size:14px;color:#6B7280;">${customerName ? `Hi ${escapeHtml(customerName)},` : "Hello,"}</div>

                <div style="margin-top:20px;font-size:18px;font-weight:800;color:#111827;">
                  You requested a password reset for your BrokeFlex Data account.
                </div>

                <div style="margin-top:12px;font-size:14px;line-height:1.7;color:#374151;">
                  If this was not you, ignore this email. Your password will not be changed
                  unless you click the link below and create a new one.
                </div>

                <!-- CTA -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                  <tr>
                    <td align="center">
                      <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#FACC15;color:#111827;font-weight:700;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:999px;">
                        Reset your password
                      </a>
                    </td>
                  </tr>
                </table>

                <!-- Security notice -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
                  <tr>
                    <td style="padding:16px;background:#F9FAFB;">
                      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;">Security notice</div>
                      <ul style="margin:10px 0 0;padding-left:18px;font-size:13px;line-height:1.8;color:#6B7280;">
                        <li>This link expires in ${escapeHtml(expiresAt)}.</li>
                        <li>This link can only be used once.</li>
                        <li>If you did not request a password reset, you can safely ignore this email.</li>
                      </ul>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:16px;font-size:12px;color:#9CA3AF;">
                  Requested for: ${escapeHtml(email)}
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
                <div style="font-size:12px;color:#9CA3AF;text-align:center;">
                  © ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}. All rights reserved.<br/>
                  This is an automated message about your account security.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export function renderAdminNotificationEmail(context: AdminAlertContext): string {
  const meta = ADMIN_EVENT_META[context.event];
  const {
    orderId,
    customerName,
    customerEmail,
    productType,
    productDetails,
    amount,
    currency,
    paymentStatus,
    fulfillmentStatus,
    details,
    errorMessage,
    eventTime,
  } = context;

  const statusTone = context.event.endsWith("_failed") ? "failed" : "success";

  const keyRows = [
    { label: "Order ID", value: orderId },
    { label: "Customer", value: customerName || customerEmail || "—" },
    { label: "Customer email", value: customerEmail || "—" },
    { label: "Product type", value: productType },
    { label: "Product details", value: productDetails },
    { label: "Amount", value: `${currency} ${amount}` },
    { label: "Payment status", value: paymentStatus },
    { label: "Fulfillment status", value: fulfillmentStatus },
  ];

  return `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F3F4F6;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#FFFFFF;border-radius:24px;overflow:hidden;border:1px solid #E5E7EB;box-shadow:0 24px 80px rgba(15,23,42,0.08);">
            <!-- Header -->
            <tr>
              <td style="background:#111827;padding:28px 32px;">
                <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.24em;color:#94A3B8;">Internal Operations Alert</div>
                <div style="margin-top:10px;font-size:26px;font-weight:800;color:#FFFFFF;letter-spacing:-.02em;line-height:1.1;">
                  ⚠ Admin Alert
                </div>
                <div style="margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
                  <span style="display:inline-flex;align-items:center;gap:8px;background:${meta.color};color:#FFFFFF;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.08em;padding:8px 16px;border-radius:999px;">
                    ${escapeHtml(meta.label)}
                  </span>
                  <span style="font-size:13px;color:#CBD5E1;line-height:1.5;">${escapeHtml(meta.description)}</span>
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;background:#F8FAFC;">
                <div style="font-size:16px;font-weight:700;color:#0F172A;">Order summary</div>
                <div style="margin-top:12px;font-size:14px;color:#475569;line-height:1.7;">
                  ${customerName ? `Customer: ${escapeHtml(customerName)}` : "Hello,"}
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-radius:18px;overflow:hidden;border:1px solid #E2E8F0;background:#FFFFFF;">
                  ${renderAdminRows(keyRows)}
                </table>

                <div style="margin-top:24px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
                  <div style="padding:20px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;">
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#667085;">Payment status</div>
                    <div style="margin-top:12px;">${renderStatusPill(paymentStatus, statusTone)}</div>
                  </div>
                  <div style="padding:20px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;">
                    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#667085;">Fulfillment status</div>
                    <div style="margin-top:12px;">${renderStatusPill(fulfillmentStatus, statusTone)}</div>
                  </div>
                </div>

                ${
                  details && details.length
                    ? `
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-radius:18px;overflow:hidden;border:1px solid #E2E8F0;background:#FFFFFF;">
                      <tr>
                        <td style="padding:18px 20px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
                          <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#475569;">Event details</div>
                        </td>
                      </tr>
                      ${details
                        .map(
                          (detail) => `
                        <tr>
                          <td style="padding:14px 20px;border-bottom:1px solid #E2E8F0;color:#334155;font-size:14px;line-height:1.7;">• ${escapeHtml(detail)}</td>
                        </tr>
                      `,
                        )
                        .join("")}
                    </table>
                  `
                    : ""
                }

                ${
                  errorMessage
                    ? `
                    <div style="margin-top:24px;padding:18px 20px;background:#FEF2F2;border:1px solid #FECACA;border-radius:18px;color:#991B1B;font-size:14px;line-height:1.7;">
                      <div style="font-weight:700;margin-bottom:8px;">Error details</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;white-space:pre-wrap;">${escapeHtml(errorMessage)}</div>
                    </div>
                  `
                    : ""
                }

                <div style="margin-top:24px;padding:20px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:18px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#94A3B8;">Event time</div>
                  <div style="margin-top:6px;font-size:14px;color:#334155;">${escapeHtml(eventTime)}</div>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#F8FAFC;padding:20px 32px;border-top:1px solid #E2E8F0;">
                <div style="font-size:12px;color:#64748B;text-align:center;">
                  Broke<span style="color:#FACC15;">Flex</span> · Internal admin notification<br/>
                  Do not reply to this automated message.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
