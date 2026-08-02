import { Resend } from "resend";
import { pool } from "../config/db";

/**
 * Email service built on Resend.
 *
 * - Reads RESEND_API_KEY, MAIL_FROM, SUPPORT_EMAIL, PAYMENT_EMAIL, ADMIN_EMAIL, and ADMIN_NOTIFICATION_EMAIL from the environment.
 * - Never exposes API keys to clients.
 * - Sending failures are caught and logged (never throw into order flows).
 * - Every attempt is persisted to the `email_logs` table.
 */

export type EmailType =
  | "order_received"
  | "payment_confirmed"
  | "order_completed"
  | "order_issue"
  | "admin_alert"
  | "welcome"
  | "password_reset"
  | "login_notification";

export type EmailLogRow = {
  id: number;
  email_type: EmailType;
  recipient: string;
  order_id: number | null;
  status: "sent" | "failed";
  error_message: string | null;
  created_at: string;
};

function getApiKey() {
  return String(process.env.RESEND_API_KEY || "").trim();
}

export function getMailFrom() {
  return String(process.env.MAIL_FROM || "BrokeFlex <no-reply@brokeflexdata.com>").trim();
}

export function getSupportEmail() {
  return String(process.env.SUPPORT_EMAIL || "support@brokeflexdata.com").trim();
}

/**
 * Sender mailbox used for customer transactional emails
 * (order received, payment confirmed, order completed).
 * Defaults to payment@brokeflexdata.com.
 */
export function getPaymentEmail() {
  return String(
    process.env.PAYMENT_EMAIL || "BrokeFlex Payments <payment@brokeflexdata.com>",
  ).trim();
}

/**
 * Official business "From" address used for admin alert emails.
 * Defaults to admin@brokeflexdata.com.
 */
export function getAdminBusinessEmail() {
  return String(process.env.ADMIN_FROM_EMAIL || "BrokeFlex Admin <admin@brokeflexdata.com>").trim();
}

/**
 * Recipient for admin alert notifications.
 * Read from ADMIN_NOTIFICATION_EMAIL env var only — no placeholder.
 * Returns '' when unset so admin alerts are simply skipped.
 */
export function getAdminNotificationEmail() {
  return String(process.env.ADMIN_NOTIFICATION_EMAIL || "").trim();
}

let client: Resend | null = null;

export function getResendClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  /** Optional sender override. Defaults to getMailFrom() when omitted. */
  from?: string;
};

/**
 * Persist an email attempt to `email_logs`. Best-effort only: a failure to log
 * must never break the order flow, so errors are swallowed.
 */
export async function logEmailAttempt(input: {
  emailType: EmailType;
  recipient: string;
  orderId: number | null;
  status: "sent" | "failed";
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO email_logs (email_type, recipient, order_id, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        input.emailType,
        input.recipient,
        input.orderId ?? null,
        input.status,
        input.errorMessage ?? null,
      ],
    );
  } catch (error: any) {
    console.warn("[EmailLog] Unable to persist email log:", error?.message || error);
  }
}

export async function getEmailLogs(limit = 100) {
  const [rows] = await pool.query("SELECT * FROM email_logs ORDER BY created_at DESC LIMIT ?", [
    limit,
  ]);
  return rows as EmailLogRow[];
}

/**
 * Send a transactional email via Resend.
 * Never throws. Returns a boolean indicating whether Resend accepted the send.
 */
export async function sendEmail(
  payload: EmailPayload,
  meta: { emailType: EmailType; orderId: number | null },
): Promise<boolean> {
  const to = String(payload.to || "").trim();
  if (!to) {
    console.warn("[Email] Missing recipient, skipping send.");
    await logEmailAttempt({
      emailType: meta.emailType,
      recipient: "(missing)",
      orderId: meta.orderId,
      status: "failed",
      errorMessage: "Missing recipient",
    });
    return false;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY is not configured; skipping send.");
    await logEmailAttempt({
      emailType: meta.emailType,
      recipient: to,
      orderId: meta.orderId,
      status: "failed",
      errorMessage: "RESEND_API_KEY is not configured",
    });
    return false;
  }

  try {
    const resend = getResendClient();
    if (!resend) {
      await logEmailAttempt({
        emailType: meta.emailType,
        recipient: to,
        orderId: meta.orderId,
        status: "failed",
        errorMessage: "Resend client unavailable",
      });
      return false;
    }

    const result = await resend.emails.send({
      from: payload.from || getMailFrom(),
      to: [to],
      subject: payload.subject,
      html: payload.html,
    });

    const errorMessage = (result as any)?.error?.message ?? null;
    const ok = !errorMessage && !(result as any)?.error;

    await logEmailAttempt({
      emailType: meta.emailType,
      recipient: to,
      orderId: meta.orderId,
      status: ok ? "sent" : "failed",
      errorMessage: ok ? null : String(errorMessage || "Resend returned an error"),
    });

    return ok;
  } catch (error: any) {
    const message = String(error?.message || "Unknown email error");
    console.error("[Email] Send failed:", message);
    await logEmailAttempt({
      emailType: meta.emailType,
      recipient: to,
      orderId: meta.orderId,
      status: "failed",
      errorMessage: message,
    });
    return false;
  }
}
