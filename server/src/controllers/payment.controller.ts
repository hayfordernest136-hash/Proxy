import { Request, Response } from 'express';
import { createOrderEvent, getOrderById, markOrderFailed, markOrderPaid, setOrderPaymentFee, type OrderRow } from '../services/order.service';
import { createNotification } from '../services/notification.service';
import { completeReferralForReferredUserId } from '../services/referral.service';
import { findUserById } from '../services/user.service';

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

async function verifyPayment(
  reference: string,
  expectedAmount: number,
): Promise<{ ok: boolean; reason?: string; provider: string }> {
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackKey) {
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
  const paystackKey = process.env.PAYSTACK_SECRET_KEY;
  if (!paystackKey) {
    return {
      ok: true,
      provider: 'sandbox',
      sandbox: true,
      reference: `sbx_${order.order_number}_${Date.now()}`,
    };
  }

  const reference = `paystack_order_${order.order_number}_${Date.now()}`;
  const callbackUrl = `${callbackOrigin}/_authenticated/checkout/${order.id}`;

  const { fee, total } = calculatePaystackFee(Number(order.total_amount));

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
    const userId = Number((req as any).userId);
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'Missing order id' });
    }

    const order = await getOrderById(Number(orderId));
    if (!order || order.user_id !== userId) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      return res.status(400).json({ message: 'Order is already paid' });
    }

    const user = await findUserById(userId);
    if (!user || !user.email) {
      return res.status(404).json({ message: 'User email not available' });
    }

    const origin =
      typeof req.headers.origin === 'string' && req.headers.origin
        ? req.headers.origin
        : process.env.FRONTEND_URL || 'http://localhost:5173';

    const payment = await initializePayment(order, user.email, origin);
    if (!payment.ok) {
      return res.status(500).json({ message: payment.reason || 'Unable to initialize payment' });
    }

    if (payment.sandbox) {
      const sandboxReference = `sbx_${order.order_number}_${Date.now()}`;
      await markOrderPaid(order.id, sandboxReference, 'sandbox');
      await createOrderEvent(order.id, 'paid', 'Sandbox payment completed.');
      await createNotification(
        userId,
        order.id,
        `Payment received for order #${order.order_number}`,
        'Sandbox payment completed and your order is now queued for fulfilment.',
      );
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
    const userId = Number((req as any).userId);
    const { orderId, reference } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'Missing order id' });
    }

    const order = await getOrderById(Number(orderId));
    if (!order || order.user_id !== userId) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.payment_status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true });
    }

    const paymentReference = reference ?? `sbx_${order.order_number}_${Date.now()}`;
    const expectedAmount = Number(order.payment_total_amount ?? order.total_amount);
    const verification = await verifyPayment(paymentReference, expectedAmount);

    if (!verification.ok) {
      if (verification.reason === 'Verification request failed') {
        return res.status(502).json({ message: verification.reason });
      }

      await markOrderFailed(order.id, paymentReference, verification.provider);
      await createOrderEvent(order.id, 'failed', `Payment failed: ${verification.reason ?? 'Verification failed'}`);
      await createNotification(
        userId,
        order.id,
        `Payment failed for order #${order.order_number}`,
        `Your payment could not be verified${verification.reason ? `: ${verification.reason}` : '.'}`,
      );

      return res.status(400).json({ message: verification.reason ?? 'Payment could not be verified' });
    }

    // Prevent duplicate processing using the order's payment status
    const updated = await markOrderPaid(order.id, paymentReference, verification.provider);
    if (!updated) {
      return res.status(409).json({ message: 'Payment already processed for this order' });
    }

    await createOrderEvent(order.id, 'paid', 'Payment received successfully.');
    await createNotification(
      userId,
      order.id,
      `Payment received for order #${order.order_number}`,
      'We have received your payment and your order is now queued for fulfilment.',
    );
    await completeReferralForReferredUserId(order.user_id, order.id);

    return res.json({ ok: true, alreadyPaid: false });
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
      await createNotification(
        order.user_id,
        order.id,
        `Payment received for order #${order.order_number}`,
        'Your payment has been confirmed and your order is now queued for fulfilment.',
      );
      await completeReferralForReferredUserId(order.user_id, order.id);

      console.log(`[Paystack Webhook] Order ${orderId} marked as paid`);
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Paystack Webhook] Error:', error);
    // Always return 200 to acknowledge receipt
    return res.status(200).json({ status: 'ok' });
  }
}
