import { getSupportEmail, sendEmail } from "./email.service";
import {
  renderLoginNotificationEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from "./email-templates";

/**
 * Account-related transactional emails (Welcome, Login Notification, Password Reset).
 *
 * IMPORTANT: All account emails MUST come from support@brokeflexdata.com.
 * The caller of these functions is responsible for ensuring the send does not
 * throw into the login/registration flow — sendEmail is already non-throwing
 * and always persisted to email_logs.
 */

function getFrontendUrl(): string {
  return String(
    process.env.FRONTEND_URL || process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  ).replace(/\/+$/, "");
}

function getLoginUrl(): string {
  return `${getFrontendUrl()}/auth`;
}

function getPasswordResetUrl(rawToken: string): string {
  return `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Welcome — sent immediately after a new account is created.
 * Non-verification: users can sign in right away.
 */
export async function sendWelcomeEmail(input: {
  userName: string;
  email: string;
}): Promise<boolean> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email) return false;

  const html = renderWelcomeEmail({
    customerName: input.userName,
    email,
    loginUrl: getLoginUrl(),
  });

  return sendEmail(
    {
      to: email,
      subject: "Welcome to BrokeFlex — your account is ready",
      html,
      from: getSupportEmail(),
    },
    { emailType: "welcome", orderId: null },
  );
}

export async function sendLoginNotificationEmail(input: {
  userName: string;
  email: string;
}): Promise<boolean> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email) return false;

  const html = renderLoginNotificationEmail({
    customerName: input.userName,
  });

  return sendEmail(
    {
      to: email,
      subject: "You just signed in to your BrokeFlex account",
      html,
      from: getSupportEmail(),
    },
    { emailType: "login_notification", orderId: null },
  );
}

/**
 * Password Reset — sent when a user requests a password reset.
 * Contains a single-use reset link that expires in 30 minutes.
 */
export async function sendPasswordResetEmail(input: {
  userName: string;
  email: string;
  rawToken: string;
  expiresAt: Date;
}): Promise<boolean> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  if (!email) return false;

  const expiresInLabel = buildExpiryLabel(input.expiresAt);

  const html = renderPasswordResetEmail({
    customerName: input.userName,
    email,
    resetUrl: getPasswordResetUrl(input.rawToken),
    expiresAt: expiresInLabel,
  });

  return sendEmail(
    {
      to: email,
      subject: "Reset your BrokeFlex password",
      html,
      from: getSupportEmail(),
    },
    { emailType: "password_reset", orderId: null },
  );
}

/** Convert an absolute expiry date into a relative label like "30 minutes". */
function buildExpiryLabel(expiresAt: Date): string {
  const diffMinutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  return `${diffMinutes} minutes`;
}
