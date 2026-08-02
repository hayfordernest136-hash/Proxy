import { Request, Response } from 'express';
import { createOrderEvent, getOrderById, markOrderFailed, markOrderPaid, setOrderPaymentFee, updateOrder, type OrderRow } from '../services/order.service';
import { createNotification } from '../services/notification.service';
import { completeReferralForReferredUserId } from '../services/referral.service';
import {
  sendAdminAlertEmail,
  sendOrderReceivedEmail,
  sendPaymentConfirmedEmail,
  sendOrderCompletedEmail,
  sendOrderIssueEmail,
} from '../services/order-email.service';
const PAYSTACK_FEE_RATE = 0.0195;
const PAYSTACK_FEE_CAP = Number(process.env.PAYSTACK_FEE_CAP ?? 0) > 0 ? Number(process.env.PAYSTACK_FEE_CAP) : null;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function calculatePaystackFee(originalAmount: number) {
  const amount = Number(originalAmount || 0);
  if (amount <= 0) {
    return { fee: 0, total: 0 };
  }

  const rawFee = amount * PAYSTACK_FEE_RATE / (1 - PAYSTACK_FEE_RATE);
  const fee = PAYSTACK_FEE_CAP !== null ? Math.min(rawFee, PAYSTACK_FEE_CAP) : rawFee;
  return {
    fee: roundMoney(fee),
    total: roundMoney(amount + fee),
  };
}

function isDataOrder(order: OrderRow) {
  return order.delivery_method === 'data_bundle' || order.product_name?.toLowerCase().includes('data');
}

function getRemaApiKey() {
  return String(process.env.REMA_API_KEY || process.env.REMA_API_TOKEN || '').trim();
}

function getRemaApiHeaderName() {
  const configured = String(process.env.REMA_API_KEY_HEADER || '').trim();
  return configured || 'X-API-KEY';
}

function buildRemaHeaders(apiKey: string) {
  const apiHeaderName = getRemaApiHeaderName();
  const normalizedHeaderName = apiHeaderName.toLowerCase();

  if (!apiKey) {
    return {
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  if (normalizedHeaderName === 'authorization') {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    } as Record<string, string>;
  }

  return {
    'Content-Type': 'application/json',
    [apiHeaderName]: apiKey,
  } as Record<string, string>;
}

function getRemaApiUrl() {
  const explicitUrl = String(process.env.REMA_API_BUY_URL || process.env.REMA_API_PURCHASE_URL || process.env.REMA_API_ENDPOINT || '').trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = String(process.env.REMA_API_BASE_URL || process.env.REMA_BASE_URL || 'https://remadata.com/api').trim();
  const suffix = String(process.env.REMA_API_BUY_PATH || '/buy-data').trim();
  return `${baseUrl.replace(/\/+$/, '')}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

function getRemaBundlesUrl() {
  const explicitUrl = String(process.env.REMA_API_BUNDLES_URL || process.env.REMA_API_LIST_URL || '').trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = String(process.env.REMA_API_BASE_URL || process.env.REMA_BASE_URL || 'https://remadata.com/api').trim();
  const suffix = String(process.env.REMA_API_BUNDLES_PATH || '/bundles').trim();
  return `${baseUrl.replace(/\/+$/, '')}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

function getRemaRequestField(name: string, fallback: string) {
  return String(process.env[name] || fallback).trim();
}

function normalizeRemaNetwork(value: string | undefined) {
  const normalized = String(value || 'mtn').trim().toLowerCase();
  if (normalized === 'mtn' || normalized === 'mtn') return 'mtn';
  if (normalized === 'telecel' || normalized === 'tigo' || normalized === 'telex') return 'telecel';
  if (normalized === 'airteltigo' || normalized === 'airtel' || normalized === 'airtel-tigo') return 'airteltigo';
  return normalized || 'mtn';
}

function parseVolumeInMb(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(1, Math.round(value));
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const mbMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(mb|mib)/i);
    if (mbMatch) return Math.max(1, Math.round(Number(mbMatch[1])));
    const gbMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(gb|gib)/i);
    if (gbMatch) return Math.max(1, Math.round(Number(gbMatch[1]) * 1024));
    const digits = trimmed.match(/(\d+)/);
    if (digits) return Math.max(1, Number(digits[1]));
  }
  return null;
}

function isDevelopmentMode() {
  return process.env.NODE_ENV !== 'production';
}

function logRemaDebug(action: string, details: Record<string, unknown>) {
  if (!isDevelopmentMode()) return;
  console.log(`[Rema][${action}]`, details);
}

function logRemaParseError(action: string, error: unknown) {
  if (!isDevelopmentMode()) return;
  console.error(`[Rema][${action}] parsing error`, error);
}

function parseRemaPurchaseResponse(payload: any) {
  const body = payload?.data ?? payload?.result ?? payload?.response ?? payload;
  const statusValue = String(payload?.status ?? body?.status ?? '').trim().toLowerCase();
  const success = statusValue === 'success';
  const message = String(payload?.message ?? body?.message ?? payload?.error ?? body?.error ?? '').trim();
  const reference = String(payload?.data?.reference ?? payload?.reference ?? body?.reference ?? body?.ref ?? '').trim();

  return { success, message, reference };
}

function getOrderCustomerEmail(order: OrderRow) {
  if (order.refill_email) return String(order.refill_email).trim();

  let metadata: any = {};
  try {
    metadata = order.refill_notes ? JSON.parse(order.refill_notes) : {};
  } catch {
    metadata = {};
  }

  return String(metadata.email || metadata.customer_email || '').trim();
}

async function fulfillDataOrder(order: OrderRow) {
  const apiKey = getRemaApiKey();

  if (!apiKey) {
    return { ok: false, reason: 'Rema Data API is not configured.' };
  }

  let metadata: any = {};
  try {
    metadata = order.refill_notes ? JSON.parse(order.refill_notes) : {};
  } catch {
    metadata = {};
  }

  const phone = String(metadata.delivery_number || metadata.deliveryNumber || order.refill_password || '').trim();
  const networkType = normalizeRemaNetwork(order.proxy_type || metadata.network || 'mtn');
  const volumeInMB = parseVolumeInMb(metadata.volume_in_mb || metadata.volumeInMB || metadata.volume || order.plan_name || order.product_name);

  if (!phone) {
    return { ok: false, reason: 'Recipient phone number is missing.' };
  }
  if (!volumeInMB) {
    return { ok: false, reason: 'Bundle size is missing.' };
  }

  const endpoint = getRemaApiUrl();
  const requestBody = {
    ref: order.payment_reference ?? `${order.order_number}`,
    phone,
    volumeInMB,
    networkType,
  };

  logRemaDebug('buy-data request', { endpoint, body: requestBody });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildRemaHeaders(apiKey),
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text().catch(() => '');
  let result: any = null;
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      logRemaParseError('buy-data', error);
    }
  }

  logRemaDebug('buy-data response', { status: response.status, body: result ?? responseText });

  const parsed = parseRemaPurchaseResponse(result ?? {});

  if (parsed.success) {
    return {
      ok: true,
      reason: parsed.message || 'Data order delivered successfully.',
      reference: parsed.reference || null,
    };
  }

  return { ok: false, reason: parsed.message || 'Unable to fulfil the data order.', reference: parsed.reference || null };
}

async function finalizeDataOrder(order: OrderRow, fulfillment: { ok: boolean; reason: string; reference?: string | null }) {
  if (fulfillment.ok) {
    await updateOrder(order.id, { status: 'completed', delivery_status: 'delivered', fulfillment_reference: fulfillment.reference ?? null });
    await createOrderEvent(order.id, 'completed', fulfillment.reason);
    if (order.user_id !== null) {
      await createNotification(
        order.user_id,
        order.id,
        `Data order fulfilled for #${order.order_number}`,
        fulfillment.reason,
      );
    }
    // Notify customer the data order is complete.
    const completedOrder = await getOrderById(order.id);
    if (completedOrder) {
      await sendOrderCompletedEmail(completedOrder);
      await sendAdminAlertEmail(completedOrder, 'data_delivery_success', {
        details: [fulfillment.reason],
      });
    }
    return { fulfilled: true, status: 'completed' as const };
  }

  await updateOrder(order.id, { status: 'processing', delivery_status: 'pending' });
  await createOrderEvent(order.id, 'processing', `Data fulfilment pending: ${fulfillment.reason}`);
  if (order.user_id !== null) {
    await createNotification(
      order.user_id,
      order.id,
      `Data order pending for #${order.order_number}`,
      `Your payment was received, but fulfilment is pending. Please retry later or contact support.`,
    );
  }
  await sendAdminAlertEmail(order, 'data_delivery_failed', {
    errorMessage: fulfillment.reason,
  });
  return { fulfilled: false, status: 'pending' as const };
}

function isSandboxReference(reference: string) {
  return typeof reference === 'string' && reference.startsWith('sbx_');
}

function isSandboxMode() {
  return String(process.env.PAYSTACK_MODE || '').trim().toLowerCase() === 'sandbox';
}

function getPaystackSecretKey() {
  return String(process.env.PAYSTACK_SECRET_KEY || '').trim();
}

function shouldUseSandboxPaystack(reference?: string) {
  return isSandboxMode() || isSandboxReference(String(reference ?? '')) || !getPaystackSecretKey();
}

async function verifyPayment(
  reference: string,
  expectedAmount: number,
): Promise<{ ok: boolean; reason?: string; provider: string }> {
  const paystackKey = getPaystackSecretKey();

  if (shouldUseSandboxPaystack(reference)) {
    return { ok: true, provider: 'sandbox' };
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${paystackKey}` } },
  );
  if (!res.ok) {
    return { ok: false, reason: 'Verification request failed', provider: 'paystack' };
  }

  const payload = (await res.json()) as {
    status?: boolean;
    data?: { status?: string; amount?: number; currency?: string };
  };

  if (!payload.status || payload.data?.status !== 'success') {
    return { ok: false, reason: 'Payment not successful', provider: 'paystack' };
  }

  if ((payload.data?.amount ?? 0) < Math.round(expectedAmount * 100)) {
    return { ok: false, reason: 'Amount mismatch', provider: 'paystack' };
  }

  return { ok: true, provider: 'paystack' };
}

async function initializePayment(
  order: OrderRow,
  email: string,
  callbackOrigin: string,
): Promise<{ ok: boolean; authorizationUrl?: string; reference?: string; reason?: string; provider: string; sandbox?: boolean }> {
  const paystackKey = getPaystackSecretKey();
  if (shouldUseSandboxPaystack()) {
    return {
      ok: true,
      provider: 'sandbox',
      sandbox: true,
      reference: `sbx_${order.order_number}_${Date.now()}`,
    };
  }

  const reference = `paystack_order_${order.order_number}_${Date.now()}`;
  const callbackPath = isDataOrder(order)
    ? `/data/checkout?orderId=${order.id}&reference=${encodeURIComponent(reference)}`
    : `/_authenticated/checkout/${order.id}`;
  const callbackUrl = new URL(callbackPath, callbackOrigin).toString();

  const isData = isDataOrder(order);
  const { fee, total } = isData
    ? { fee: 0, total: Number(order.total_amount) }
    : calculatePaystackFee(Number(order.total_amount));

  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: Math.round(total * 100),
      currency: order.currency,
      reference,
      callback_url: callbackUrl,
      metadata: {
        orderId: order.id,
        userId: order.user_id,
        original_amount: Number(order.total_amount),
        payment_fee: fee,
      },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      reason: payload?.message || 'Paystack initialization failed',
      provider: 'paystack',
    };
  }

  if (!payload?.status || !payload?.data?.authorization_url || !payload?.data?.reference) {
    return {
      ok: false,
      reason: payload?.message || 'Paystack initialization returned invalid response',
      provider: 'paystack',
    };
  }

  await setOrderPaymentFee(order.id, fee, total);

  return {
    ok: true,
    provider: 'paystack',
    authorizationUrl: payload.data.authorization_url,
    reference: payload.data.reference,
  };
}

export async function initiatePaymentHandler(req: Request, res: Response) {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'Missing order id' });
    }

    const order = await getOrderById(Number(orderId));
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    const orderEmail = getOrderCustomerEmail(order);
    if (!orderEmail) {
      return res.status(400).json({ message: 'Customer email not available' });
    }

    const origin =
      typeof req.headers.origin === 'string' && req.headers.origin
        ? req.headers.origin
        : process.env.FRONTEND_URL || 'http://localhost:5173';

    const payment = await initializePayment(order, orderEmail, origin);
    if (!payment.ok) {
      return res.status(500).json({ message: payment.reason || 'Unable to initialize payment' });
    }

    if (payment.sandbox) {
      const sandboxReference = `sbx_${order.order_number}_${Date.now()}`;
      await markOrderPaid(order.id, sandboxReference, 'sandbox');
      await createOrderEvent(order.id, 'paid', 'Sandbox payment completed.');
      if (order.user_id !== null) {
        await createNotification(
          order.user_id,
          order.id,
          `Payment received for order #${order.order_number}`,
          'Sandbox payment completed and your order is now queued for fulfilment.',
        );
      }
      const sandboxPaidOrder = await getOrderById(order.id);
      if (sandboxPaidOrder) {
        await sendPaymentConfirmedEmail(sandboxPaidOrder, sandboxReference);
        await sendAdminAlertEmail(sandboxPaidOrder, 'payment_success');
      }
      if (isDataOrder(order)) {
        const fulfillment = await fulfillDataOrder(order);
        const finalState = await finalizeDataOrder(order, fulfillment);
        return res.json({ ok: true, sandbox: true, reference: sandboxReference, fulfillmentStatus: finalState.status });
      }
      return res.json({ ok: true, sandbox: true, reference: sandboxReference });
    }

    return res.json({ ok: true, authorizationUrl: payment.authorizationUrl, reference: payment.reference });
  } catch (error) {
    console.error('Payment initiation failed:', error);
    return res.status(500).json({ message: 'Unable to initialize payment' });
  }
}

export async function confirmPaymentHandler(req: Request, res: Response) {
  try {
    const { orderId, reference } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'Missing order id' });
    }

    const order = await getOrderById(Number(orderId));
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      if (isDataOrder(order) && !order.fulfillment_reference && order.status !== 'completed' && order.delivery_status !== 'delivered') {
        const fulfillment = await fulfillDataOrder(order);
        if (fulfillment.ok) {
          await updateOrder(order.id, { status: 'completed', delivery_status: 'delivered', fulfillment_reference: fulfillment.reference ?? null });
          await createOrderEvent(order.id, 'completed', fulfillment.reason);
          if (order.user_id !== null) {
            await createNotification(
              order.user_id,
              order.id,
              `Data order fulfilled for #${order.order_number}`,
              fulfillment.reason,
            );
          }
          return res.json({ ok: true, alreadyPaid: true, fulfillmentStatus: 'completed' });
        }

        await updateOrder(order.id, { status: 'processing', delivery_status: 'pending' });
        await createOrderEvent(order.id, 'processing', `Data fulfilment pending: ${fulfillment.reason}`);
        if (order.user_id !== null) {
          await createNotification(
            order.user_id,
            order.id,
            `Data order pending for #${order.order_number}`,
            `Your payment was received, but fulfilment is pending. Please retry later or contact support.`,
          );
        }
        return res.json({ ok: true, alreadyPaid: true, fulfillmentStatus: 'pending' });
      }

      return res.json({ ok: true, alreadyPaid: true, fulfillmentStatus: order.status });
    }

    if (!reference) {
      return res.status(400).json({ message: 'Missing payment reference' });
    }

    const paymentReference = reference;
    const expectedAmount = Number(order.payment_total_amount ?? order.total_amount);
    const verification = await verifyPayment(paymentReference, expectedAmount);

    if (!verification.ok) {
      if (verification.reason === 'Verification request failed') {
        return res.status(502).json({ message: verification.reason });
      }

      await markOrderFailed(order.id, paymentReference, verification.provider);
      await createOrderEvent(order.id, 'failed', `Payment failed: ${verification.reason ?? 'Verification failed'}`);
      if (order.user_id !== null) {
        await createNotification(
          order.user_id,
          order.id,
          `Payment failed for order #${order.order_number}`,
          `Your payment could not be verified${verification.reason ? `: ${verification.reason}` : '.'}`,
        );
      }
      // Notify customer about the payment issue.
      const failedOrder = await getOrderById(order.id);
      if (failedOrder) {
        await sendOrderIssueEmail(
          failedOrder,
          `We could not confirm your payment${verification.reason ? ` (${verification.reason})` : ''}.`,
        );
        await sendAdminAlertEmail(failedOrder, 'payment_failed', {
          errorMessage: verification.reason || 'Payment verification failed',
        });
      }

      return res.status(400).json({ message: verification.reason ?? 'Payment could not be verified' });
    }

    const updated = await markOrderPaid(order.id, paymentReference, verification.provider);
    if (!updated) {
      return res.status(409).json({ message: 'Payment already processed for this order' });
    }

    await createOrderEvent(order.id, 'paid', 'Payment received successfully.');
    if (order.user_id !== null) {
      await createNotification(
        order.user_id,
        order.id,
        `Payment received for order #${order.order_number}`,
        'We have received your payment and your order is now queued for fulfilment.',
      );
    }
    // Notify the customer that their payment was confirmed.
    const paidOrder = await getOrderById(order.id);
    if (paidOrder) {
      await sendPaymentConfirmedEmail(paidOrder, paymentReference);
      await sendAdminAlertEmail(paidOrder, 'payment_success');
    }

    if (isDataOrder(order)) {
      const fulfillment = await fulfillDataOrder(order);
      const finalState = await finalizeDataOrder(order, fulfillment);
      return res.json({ ok: true, alreadyPaid: false, fulfillmentStatus: finalState.status });
    }

    if (order.user_id !== null) {
      await completeReferralForReferredUserId(order.user_id, order.id);
    }
    return res.json({ ok: true, alreadyPaid: false, fulfillmentStatus: 'paid' });
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    return res.status(500).json({ message: 'Unable to confirm payment' });
  }
}

// ---- Paystack Webhook Handler ----
// Paystack sends webhook events for transaction successes, failures, etc.
// Never trust client-side payment success; always verify via webhook.
export async function paystackWebhookHandler(req: Request, res: Response) {
  try {
    // Verify webhook signature
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      console.warn('[Paystack Webhook] Secret key not configured');
      return res.status(200).json({ status: 'ignored' });
    }

    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      console.warn('[Paystack Webhook] Missing signature header');
      return res.status(200).json({ status: 'ignored' });
    }

    // Compute expected signature: HMAC-SHA512 of the raw request body
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[Paystack Webhook] Invalid signature');
      return res.status(200).json({ status: 'ignored' });
    }

    const event = req.body;
    console.log(`[Paystack Webhook] Event received: ${event.event}`);

    // Handle successful charge
    if (event.event === 'charge.success') {
      const data = event.data;
      const metadata = data?.metadata || {};
      const orderId = Number(metadata.orderId);
      const reference = data.reference;

      if (!orderId || !reference) {
        console.warn('[Paystack Webhook] Missing orderId or reference in metadata');
        return res.status(200).json({ status: 'ok' });
      }

      const order = await getOrderById(orderId);
      if (!order) {
        console.warn(`[Paystack Webhook] Order ${orderId} not found`);
        return res.status(200).json({ status: 'ok' });
      }

      if (order.payment_status === 'paid') {
        console.log(`[Paystack Webhook] Order ${orderId} already marked as paid`);
        return res.status(200).json({ status: 'ok' });
      }

      await markOrderPaid(orderId, reference, 'paystack');
      await createOrderEvent(orderId, 'paid', 'Payment confirmed via webhook.');
      if (order.user_id !== null) {
        await createNotification(
          order.user_id,
          order.id,
          `Payment received for order #${order.order_number}`,
          'Your payment has been confirmed and your order is now queued for fulfilment.',
        );
      }
      const webhookPaidOrder = await getOrderById(orderId);
      if (webhookPaidOrder) {
        await sendPaymentConfirmedEmail(webhookPaidOrder, reference);
        await sendAdminAlertEmail(webhookPaidOrder, 'payment_success');
      }
      if (isDataOrder(order)) {
        const fulfillment = await fulfillDataOrder(order);
        await finalizeDataOrder(order, fulfillment);
      } else if (order.user_id !== null) {
        await completeReferralForReferredUserId(order.user_id, order.id);
      }

      console.log(`[Paystack Webhook] Order ${orderId} marked as paid`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Paystack Webhook] Error:', error);
    // Always return 200 to acknowledge receipt
    return res.status(200).json({ status: 'ok' });
  }
}
