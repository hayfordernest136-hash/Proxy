import { Request, Response } from 'express';
import { createOrderEvent, getAllOrders, getOrderById, updateOrder } from '../services/order.service';
import { createNotification } from '../services/notification.service';
import { sendAdminAlertEmail, sendOrderCompletedEmail, sendOrderIssueEmail } from '../services/order-email.service';
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

function isDevelopmentMode() {
  return process.env.NODE_ENV !== 'production';
}

export function getRemaApiBaseUrl() {
  return String(process.env.REMA_API_BASE_URL || process.env.REMA_BASE_URL || 'https://remadata.com/api').trim();
}

export function getRemaApiKey() {
  return String(process.env.REMA_API_KEY || process.env.REMA_API_TOKEN || '').trim();
}

export function getRemaApiHeaderName() {
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

export function remaStatusToLocalStatus(remaStatus: string) {
  const normalized = String(remaStatus || '').trim().toLowerCase();

  if (!normalized) return null;
  if (normalized.includes('refunded')) {
    return 'refunded';
  }
  if (
    normalized.includes('delivered') ||
    normalized.includes('success') ||
    normalized.includes('completed') ||
    normalized.includes('fulfilled') ||
    normalized.includes('fulfil')
  ) {
    return 'completed';
  }
  if (
    normalized.includes('fail') ||
    normalized.includes('cancelled') ||
    normalized.includes('canceled') ||
    normalized.includes('error') ||
    normalized.includes('rejected')
  ) {
    return 'failed';
  }
  if (
    normalized.includes('paid') ||
    normalized.includes('processing') ||
    normalized.includes('in progress') ||
    normalized.includes('queued') ||
    normalized.includes('active') ||
    normalized.includes('pending')
  ) {
    return 'processing';
  }
  return null;
}

async function fetchRemaOrderStatus(reference: string) {
  const apiKey = getRemaApiKey();
  if (!reference) {
    return null;
  }

  try {
    const endpoint = `${getRemaApiBaseUrl().replace(/\/+$/, '')}/order-status/${encodeURIComponent(reference)}`;
    logRemaDebug('order-status-request', { endpoint });

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: buildRemaHeaders(apiKey),
    });

    const responseText = await response.text().catch(() => '');
    let payload: any = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        logRemaDebug('order-status-parse-error', { error: String(error), responseText });
      }
    }

    logRemaDebug('order-status-response', {
      requestUrl: endpoint,
      status: response.status,
      body: payload ?? responseText,
      apiKeyLoaded: Boolean(apiKey),
      apiHeaderName: getRemaApiHeaderName(),
    });

    if (!response.ok) {
      return null;
    }

    const data = payload?.data ?? payload;
    return {
      status: String(data?.status ?? payload?.status ?? '').trim(),
      reference: String(data?.reference ?? payload?.reference ?? '').trim(),
      message: String(payload?.message ?? data?.message ?? '').trim(),
    };
  } catch (error) {
    logRemaDebug('order-status-error', { error: String(error) });
    return null;
  }
}

export function logRemaDebug(action: string, details: Record<string, unknown>) {
  if (!isDevelopmentMode()) return;
  console.log(`[Rema][${action}]`, details);
}

export function isProxyOrder(order: { delivery_method?: string | null; product_name?: string | null }) {
  return order.delivery_method !== 'data_bundle' && !String(order.product_name || '').toLowerCase().includes('data');
}

export async function getAdminOrdersHandler(_req: Request, res: Response) {
  try {
    const orders = await getAllOrders();
    return res.json(orders);
  } catch (error) {
    console.error('Failed to load admin orders:', error);
    return res.status(500).json({ message: 'Unable to load orders' });
  }
}

export async function getAdminOrderHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    return res.json(order);
  } catch (error) {
    console.error('Failed to load admin order:', error);
    return res.status(500).json({ message: 'Unable to load order' });
  }
}

export async function getAdminOrderRemaStatusHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!order.fulfillment_reference) {
      return res.status(400).json({ message: 'No fulfillment reference available for this order' });
    }

    const statusInfo = await fetchRemaOrderStatus(order.fulfillment_reference);
    if (!statusInfo) {
      return res.status(502).json({ message: 'Unable to fetch fulfillment status from Rema' });
    }

const localStatus = remaStatusToLocalStatus(statusInfo.status);
      if (localStatus && localStatus !== order.status) {
        const updatedOrder = await updateOrder(orderId, {
          status: localStatus,
          delivery_status:
            localStatus === 'completed' ? 'delivered' : localStatus === 'failed' ? 'failed' : order.delivery_status,
        });
        await createOrderEvent(
          orderId,
          localStatus,
          `Rema status synced: ${String(statusInfo.status).trim() || 'Unknown'}`,
        );
        if (updatedOrder) {
          const isProxyOrder =
            updatedOrder.delivery_method !== 'data_bundle' &&
            !String(updatedOrder.product_name || '').toLowerCase().includes('data');

          if (isProxyOrder) {
            if (localStatus === 'completed') {
              await sendAdminAlertEmail(updatedOrder, 'proxy_fulfillment_completed');
            } else if (localStatus === 'failed') {
              await sendAdminAlertEmail(updatedOrder, 'proxy_fulfillment_failed', {
                errorMessage: `Rema status synced: ${String(statusInfo.status).trim() || 'Unknown'}`,
              });
            }
          } else {
            if (localStatus === 'completed') {
              await sendAdminAlertEmail(updatedOrder, 'data_delivery_success');
            } else if (localStatus === 'failed') {
              await sendAdminAlertEmail(updatedOrder, 'data_delivery_failed', {
                errorMessage: `Rema status synced: ${String(statusInfo.status).trim() || 'Unknown'}`,
              });
            }
          }
      }
    }

    return res.json(statusInfo);
  } catch (error) {
    console.error('Failed to load admin order Rema status:', error);
    return res.status(500).json({ message: 'Unable to load fulfillment status' });
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

export async function getAdminRemaDebugHandler(_req: Request, res: Response) {
  try {
    const apiKey = getRemaApiKey();
    const baseUrl = getRemaApiBaseUrl().replace(/\/+$/, '');
    const headerName = getRemaApiHeaderName();
    const headers = buildRemaHeaders(apiKey);

    const endpoints = [
      { name: 'walletBalance', path: '/wallet-balance', network: null },
      { name: 'bundles', path: '/bundles', network: null },
      { name: 'bundlesMtn', path: '/bundles', network: 'mtn' },
      { name: 'bundlesTelecel', path: '/bundles', network: 'telecel' },
      { name: 'bundlesAirtelTigo', path: '/bundles', network: 'airteltigo' },
    ];

    const results: Record<string, { status: number; ok: boolean; body: unknown; requestUrl: string; method: string; network: string | null; apiKeyLoaded: boolean; apiHeaderName: string }> = {};

    for (const endpoint of endpoints) {
      const url = new URL(`${baseUrl}${endpoint.path}`);
      if (endpoint.network) {
        url.searchParams.set('network', endpoint.network);
      }

      let body: unknown = null;
      let status = 0;
      let ok = false;

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
        });

        const text = await response.text().catch(() => '');
        status = response.status;
        ok = response.ok;

        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }
      } catch (error) {
        body = { error: String(error) };
      }

      const details = {
        requestUrl: url.toString(),
        method: 'GET',
        network: endpoint.network,
        status,
        ok,
        body,
        apiKeyLoaded: Boolean(apiKey),
        apiHeaderName: headerName,
      };

      logRemaDebug('admin-rema-debug', details);
      results[endpoint.name] = details;
    }

    const bundlesResponse = results.bundles;
    const onlyMtnBundles = Array.isArray((bundlesResponse.body as any)?.data)
      && (bundlesResponse.body as any).data.length > 0
      && (bundlesResponse.body as any).data.every((item: any) => String(item?.network || '').trim().toLowerCase() === 'mtn');

    return res.json({
      runtime: {
        apiBaseUrl: baseUrl,
        apiKeyLoaded: Boolean(apiKey),
        apiHeaderName: headerName,
      },
      responses: results,
      providerObservation: onlyMtnBundles
        ? 'GET /bundles returned only MTN bundles while using the documented endpoint.'
        : undefined,
    });
  } catch (error) {
    console.error('Failed to run Rema debug endpoint:', error);
    return res.status(500).json({ message: 'Unable to run Rema debug endpoint.' });
  }
}

export async function updateOrderHandler(req: Request, res: Response) {
  try {
    const orderId = Number(req.params.orderId);
    const { status, cd_key, admin_notes, refill_proof_url, delivery_status } = req.body;
    const order = await getOrderById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const statusValue = status as string | undefined;
    const normalizedStatus = statusValue?.trim().toLowerCase();
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

    let shouldSendCompletionEmail = false;

    let completionEmailReason: string | undefined;

    if (status && updatedOrder) {
      await createOrderEvent(orderId, status, STATUS_MESSAGE[status] ?? 'Order status updated');
      if (order.user_id !== null) {
        await createNotification(
          order.user_id,
          order.id,
          `Order #${order.order_number} update`,
          `${order.product_name}: ${STATUS_MESSAGE[status] ?? 'Order status updated'}`,
        );
      }

      if (normalizedStatus === 'completed') {
        if (isProxyOrder(updatedOrder)) {
          shouldSendCompletionEmail = true;
          await sendAdminAlertEmail(updatedOrder, 'proxy_fulfillment_completed');
        }
      }

      if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled' || normalizedStatus === 'refunded') {
        await sendOrderIssueEmail(
          updatedOrder,
          updatedOrder.admin_notes || `Order status changed to ${statusValue}`,
        );

        if (isProxyOrder(updatedOrder)) {
          await sendAdminAlertEmail(updatedOrder, 'proxy_fulfillment_failed', {
            errorMessage: updatedOrder.admin_notes || `Order status changed to ${statusValue}`,
          });
        } else {
          await sendAdminAlertEmail(updatedOrder, 'data_delivery_failed', {
            errorMessage: updatedOrder.admin_notes || `Order status changed to ${statusValue}`,
          });
        }
      }

      if (!isProxyOrder(updatedOrder) && updatedOrder.delivery_status === 'delivered') {
        shouldSendCompletionEmail = true;
        await sendAdminAlertEmail(updatedOrder, 'data_delivery_success');
      }
    }

    if (cd_key !== undefined && cd_key) {
      await createOrderEvent(orderId, 'cd_key_added', 'CD key added to order by admin');
      if (isProxyOrder(updatedOrder) && updatedOrder.status === 'completed') {
        shouldSendCompletionEmail = true;
        completionEmailReason = 'cd_key_added';
      }
    }

    if (refill_proof_url !== undefined && refill_proof_url) {
      await createOrderEvent(orderId, 'refill_proof_uploaded', 'Refill proof uploaded by admin');
      if (!isProxyOrder(updatedOrder) && updatedOrder.delivery_status === 'delivered') {
        shouldSendCompletionEmail = true;
        completionEmailReason = 'refill_proof_uploaded';
      }
    }

    if (delivery_status !== undefined) {
      await createOrderEvent(orderId, 'delivery_status_changed', `Delivery status: ${delivery_status}`);
      if (!isProxyOrder(updatedOrder) && String(delivery_status).trim().toLowerCase() === 'delivered') {
        shouldSendCompletionEmail = true;
        completionEmailReason = 'delivery_status_changed';
      }
    }

    if (shouldSendCompletionEmail) {
      try {
        await sendOrderCompletedEmail(updatedOrder);
      } catch (error) {
        console.warn('[Admin] Failed to send order completed email:', error);
      }
    }

    if (admin_notes !== undefined && admin_notes) {
      await createOrderEvent(orderId, 'admin_note_added', 'Admin added an internal note');
      try {
        if (order.user_id !== null) {
          await createNotification(order.user_id, order.id, `Order #${order.order_number} update`, `A note was added to your order: ${String(admin_notes).slice(0,200)}`);
        }
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
