import { Request, Response } from "express";
import { pool } from "../config/db";
import {
  createOrder,
  createOrderEvent,
  getOrderById,
  updateOrder,
  type OrderRow,
} from "../services/order.service";
import { createNotification } from "../services/notification.service";
import { sendAdminAlertEmail, sendOrderReceivedEmail } from "../services/order-email.service";
import { normalizeBundleSizeLabel, parsePublicRemaBundlesPage } from "../utils/rema-bundles";

const BUNDLE_CACHE_TTL_MS = 60_000;
const bundleCache = new Map<string, { expiresAt: number; value: any[] }>();

function isDevelopmentMode() {
  return process.env.NODE_ENV !== "production";
}

function logRemaDebug(action: string, details: Record<string, unknown>) {
  if (!isDevelopmentMode()) return;
  console.log(`[Rema][${action}]`, details);
}

function logRemaParseError(action: string, error: unknown) {
  if (!isDevelopmentMode()) return;
  console.error(`[Rema][${action}] parsing error`, error);
}

function logRemaRequestDetails(action: string, details: Record<string, unknown>) {
  if (!isDevelopmentMode()) return;
  console.log(`[Rema][${action}]`, details);
}

function normalizeRemaNetwork(value: string | undefined, fallbackNetwork: string) {
  const normalized = String(value || fallbackNetwork || "mtn")
    .trim()
    .toLowerCase();
  if (normalized === "mtn") return "mtn";
  if (normalized === "telecel" || normalized === "tigo" || normalized === "telex") return "telecel";
  if (normalized === "airteltigo" || normalized === "airtel" || normalized === "airtel-tigo")
    return "airteltigo";
  return normalized || "mtn";
}

function normalizeBundle(item: any, fallbackNetwork: string, index: number) {
  const rawName = String(
    item?.name ??
      item?.bundle_name ??
      item?.title ??
      item?.label ??
      item?.volume ??
      item?.size ??
      "",
  ).trim();
  const rawVolume = String(item?.volume ?? item?.volumeLabel ?? item?.size ?? "").trim();
  const volume = normalizeBundleSizeLabel(rawVolume || rawName);
  const name = normalizeBundleSizeLabel(rawName || volume || "Data bundle");
  const rawPrice = Number(
    item?.price ?? item?.amount ?? item?.api_price ?? item?.bundle_price ?? item?.cost,
  );
  const hasValidPrice = Number.isFinite(rawPrice) && rawPrice >= 0;
  const currency = String(item?.currency ?? "GHS").trim() || "GHS";
  const network = normalizeRemaNetwork(item?.network ?? fallbackNetwork, fallbackNetwork);
  const id = String(
    item?.id ??
      item?.bundle_id ??
      item?.reference ??
      item?.product_id ??
      `${network}-${volume || name || index + 1}`,
  ).trim();

  if (!hasValidPrice || (!name && !volume)) {
    return null;
  }

  const markupPercent = Number(process.env.REMA_RESELLER_MARKUP_PERCENT || "10");
  const price =
    Number.isFinite(markupPercent) && markupPercent > 0
      ? Number((rawPrice * (1 + markupPercent / 100)).toFixed(2))
      : rawPrice;

  return {
    id,
    name: name || volume || "Data bundle",
    volume,
    price,
    currency,
    network,
    reference: id,
    description: String(item?.description ?? "").trim(),
  };
}

function extractPayload(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    return (
      payload.data ??
      payload.result ??
      payload.response ??
      payload.bundles ??
      payload.plans ??
      payload.products ??
      payload.packages ??
      payload.items ??
      payload.results ??
      null
    );
  }
  return null;
}

function extractBundles(payload: any, network: string): any[] {
  const source = extractPayload(payload);
  if (Array.isArray(source)) {
    return source
      .map((item, index) => normalizeBundle(item, network, index))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }

  return [];
}

async function fetchLiveRemaBundlesForNetwork(networkValue: string): Promise<any[]> {
  const apiKey = getRemaApiKey();
  if (!apiKey) {
    return [];
  }

  const variants = Array.from(
    new Set(
      [
        networkValue,
        networkValue === "mtn" ? "mtn" : undefined,
        networkValue === "telecel" ? "telecel" : undefined,
        networkValue === "telecel" ? "tigo" : undefined,
        networkValue === "telecel" ? "telex" : undefined,
        networkValue === "airteltigo" ? "airteltigo" : undefined,
        networkValue === "airteltigo" ? "airtel" : undefined,
        networkValue === "airteltigo" ? "airtel-tigo" : undefined,
        "all",
      ].filter(Boolean) as string[],
    ),
  );

  const baseUrl = getRemaApiBaseUrl();
  const bundlesUrl = String(
    process.env.REMA_API_BUNDLES_URL || process.env.REMA_API_LIST_URL || "",
  ).trim();
  const baseEndpoint =
    bundlesUrl ||
    `${baseUrl.replace(/\/+$/, "")}${String(process.env.REMA_API_BUNDLES_PATH || "/bundles").trim()}`;

  for (const variant of variants) {
    try {
      const requestUrl = new URL(baseEndpoint);
      requestUrl.searchParams.set("network", variant);

      const response = await fetch(requestUrl.toString(), {
        method: "GET",
        headers: buildRemaHeaders(apiKey),
      });

      const responseText = await response.text().catch(() => "");
      let payload: any = null;
      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          payload = null;
        }
      }

      logRemaRequestDetails("fetch-live-bundles", {
        requestUrl: requestUrl.toString(),
        method: "GET",
        network: variant,
        status: response.status,
        body: payload ?? responseText,
        apiKeyLoaded: Boolean(apiKey),
      });

      const bundles = extractBundles(payload, variant);
      if (bundles.length) {
        return bundles;
      }
    } catch {
      // Keep retrying the supported network aliases until one succeeds.
    }
  }

  return [];
}

function getCacheKey(network: string) {
  return `data:${network.toLowerCase()}`;
}

function buildGuestCustomerMetadata(customer: any, items: any[]) {
  const firstItem = Array.isArray(items) ? items[0] : null;
  const firstBundle = String(firstItem?.bundle || firstItem?.name || "").trim();
  const firstDelivery = String(
    firstItem?.deliveryNumber || firstItem?.delivery_number || "",
  ).trim();
  const volumeInMb = firstItem?.volumeInMB ?? firstItem?.volume_in_mb ?? null;

  return JSON.stringify({
    customer_name: customer?.full_name || "",
    full_name: customer?.full_name || "",
    email: customer?.email || "",
    contact_number: customer?.contact_number || "",
    delivery_number: firstDelivery,
    delivery_numbers: (items || []).map(
      (item: any) => item.deliveryNumber || item.delivery_number || "",
    ),
    bundles: (items || []).map((item: any) => item.bundle || item.name || ""),
    bundle: firstBundle,
    network: firstItem?.network || "",
    volume: firstBundle,
    volume_in_mb: volumeInMb,
  });
}

function normalizeTrackingNumber(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");
}

function formatOrderReference(orderNumber: number) {
  const digits = String(orderNumber).padStart(6, "0");
  return `BRK-${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function parseOrderReference(value: string) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;

  const directMatch = normalized.match(/^BRK-(\d{3})-(\d{3})$/i);
  if (directMatch) {
    const numeric = Number(`${directMatch[1]}${directMatch[2]}`);
    return Number.isFinite(numeric) ? numeric : null;
  }

  const compactMatch = normalized.match(/^BRK-(\d+)$/i);
  if (compactMatch) {
    return Number(compactMatch[1]) || null;
  }

  const pureNumber = Number(normalized.replace(/[^\d]/g, ""));
  return Number.isFinite(pureNumber) ? pureNumber : null;
}

function parseGuestMetadata(order: OrderRow) {
  const fallback = {
    contact_number: "",
    delivery_number: "",
    delivery_numbers: [] as string[],
    bundle: order.plan_name || "",
    network: order.proxy_type || "",
  };

  if (!order.refill_notes) {
    return fallback;
  }

  try {
    const parsed =
      typeof order.refill_notes === "string" ? JSON.parse(order.refill_notes) : order.refill_notes;
    return {
      contact_number: String(
        parsed?.contact_number || parsed?.customer_contact_number || "",
      ).trim(),
      delivery_number: String(parsed?.delivery_number || parsed?.deliveryNumber || "").trim(),
      delivery_numbers: Array.isArray(parsed?.delivery_numbers)
        ? parsed.delivery_numbers
            .map((value: unknown) => String(value || "").trim())
            .filter(Boolean)
        : [],
      bundle: String(parsed?.bundle || parsed?.bundles?.[0] || order.plan_name || "").trim(),
      network: String(parsed?.network || order.proxy_type || "").trim(),
    };
  } catch {
    return fallback;
  }
}

function getRemaApiBaseUrl() {
  return process.env.REMA_API_BASE_URL || process.env.REMA_BASE_URL || "https://remadata.com/api";
}

function getRemaApiKey() {
  return process.env.REMA_API_KEY || process.env.REMA_API_TOKEN || "";
}

function getRemaApiHeaderName() {
  const configured = String(process.env.REMA_API_KEY_HEADER || "").trim();
  return configured || "X-API-KEY";
}

function buildRemaHeaders(apiKey: string) {
  const apiHeaderName = getRemaApiHeaderName();
  const normalizedHeaderName = apiHeaderName.toLowerCase();

  if (!apiKey) {
    return {
      "Content-Type": "application/json",
    } as Record<string, string>;
  }

  if (normalizedHeaderName === "authorization") {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    } as Record<string, string>;
  }

  return {
    "Content-Type": "application/json",
    [apiHeaderName]: apiKey,
  } as Record<string, string>;
}

async function fetchPublicRemaBundles(network: string) {
  try {
    const response = await fetch("https://remadata.com/bundles", {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parsePublicRemaBundlesPage(html, network);
  } catch (error) {
    console.error("Failed to fetch public Rema bundles:", error);
    return [];
  }
}

async function fetchRemaOrderStatus(reference: string) {
  const apiKey = getRemaApiKey();
  if (!reference) {
    return null;
  }

  try {
    const endpoint = `${getRemaApiBaseUrl().replace(/\/+$/, "")}/order-status/${encodeURIComponent(reference)}`;
    if (isDevelopmentMode()) {
      console.log("[Data API] Rema order-status request", { endpoint });
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers: buildRemaHeaders(apiKey),
    });

    const responseText = await response.text().catch(() => "");
    let payload: any = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        logRemaParseError("order-status", error);
      }
    }

    logRemaRequestDetails("order-status", {
      requestUrl: endpoint,
      method: "GET",
      network: "order-status",
      status: response.status,
      body: payload ?? responseText,
      apiKeyLoaded: Boolean(apiKey),
      apiHeaderName: getRemaApiHeaderName(),
    });

    if (!response.ok) {
      if (isDevelopmentMode()) {
        console.error("[Data API] Rema order-status failed", {
          status: response.status,
          body: payload ?? responseText,
        });
      }
      return null;
    }

    const data = payload?.data ?? payload;
    return {
      status: String(data?.status ?? payload?.status ?? "").trim(),
      reference: String(data?.reference ?? payload?.reference ?? "").trim(),
      message: String(payload?.message ?? data?.message ?? "").trim(),
      estimatedTime: extractEstimatedTime(data) ?? extractEstimatedTime(payload),
    };
  } catch (error) {
    console.error("Failed to fetch Rema order status:", error);
    return null;
  }
}

function extractEstimatedTime(payload: any): string | null {
  const candidateKeys = new Set([
    "estimated_time",
    "eta",
    "estimatedTime",
    "estimated_delivery",
    "estimated_delivery_time",
    "estimated_delivery_time_text",
    "expected_delivery_time",
    "delivery_eta",
    "deliveryEta",
    "estimated_eta",
  ]);

  const seen = new Set<any>();

  function walk(value: any): string | null {
    if (!value || seen.has(value)) return null;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = walk(item);
        if (nested) return nested;
      }
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (value && typeof value === "object") {
      for (const [key, nestedValue] of Object.entries(value)) {
        if (candidateKeys.has(key)) {
          const direct = walk(nestedValue);
          if (direct) return direct;
        }
        const nested = walk(nestedValue);
        if (nested && /(?:estimated|eta|delivery)/i.test(key)) {
          return nested;
        }
      }

      const fallbackValue = (value as any).value ?? (value as any).text ?? (value as any).label;
      if (typeof fallbackValue === "string") {
        const trimmed = fallbackValue.trim();
        if (trimmed) return trimmed;
      }
    }

    return null;
  }

  return walk(payload);
}

function deriveDisplayStatus(order: OrderRow) {
  const normalizedStatus = String(order.status || "")
    .trim()
    .toLowerCase();
  const normalizedDeliveryStatus = String(order.delivery_status || "")
    .trim()
    .toLowerCase();

  if (
    normalizedStatus === "completed" ||
    normalizedDeliveryStatus === "delivered" ||
    normalizedStatus === "delivered"
  ) {
    return "Delivered";
  }
  if (normalizedStatus === "failed" || normalizedDeliveryStatus === "failed") {
    return "Failed";
  }
  if (normalizedStatus === "refunded" || normalizedDeliveryStatus === "refunded") {
    return "Refunded";
  }
  if (
    normalizedStatus === "processing" ||
    normalizedStatus === "paid" ||
    normalizedDeliveryStatus === "pending"
  ) {
    return "Processing";
  }
  return "Pending";
}

function serializeTrackedOrder(order: OrderRow) {
  const guestMetadata = parseGuestMetadata(order);
  const orderNumber = formatOrderReference(order.order_number);
  const contactNumber = normalizeTrackingNumber(guestMetadata.contact_number);
  const deliveryNumber = guestMetadata.delivery_number || guestMetadata.delivery_numbers[0] || "";

  return {
    orderId: orderNumber,
    orderNumber: order.order_number,
    network: guestMetadata.network || order.proxy_type || "Data",
    dataBundle: guestMetadata.bundle || order.plan_name || "Data bundle",
    amount: Number(order.total_amount || 0),
    currency: order.currency || "GHS",
    deliveryNumber,
    contactNumber,
    status: deriveDisplayStatus(order),
    deliveryStatus: order.delivery_status || "pending",
    orderDate: order.created_at,
    lastUpdate: order.updated_at,
  };
}

export async function createDataOrderHandler(req: Request, res: Response) {
  try {
    const { items = [], customer = {} } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No data items provided" });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + Number(item.price || 0), 0);
    const deliveryNumbers = items.map((item: any) =>
      String(item.deliveryNumber || item.delivery_number || "").trim(),
    );
    const invalid = deliveryNumbers.some((value) => !value);

    if (invalid) {
      return res.status(400).json({ message: "Each bundle requires a delivery number" });
    }

    const email = String(customer?.email || "").trim();
    if (!email) {
      return res.status(400).json({ message: "Email address is required" });
    }

    const order = await createOrder({
      user_id: null,
      product_id: null,
      plan_id: null,
      product_name: "Data Bundle",
      plan_name: items.map((item: any) => item.bundle || item.name || "Bundle").join(", "),
      proxy_type: items[0]?.network || "Data",
      quantity: items.length,
      unit_price: Number(totalAmount / Math.max(items.length, 1)),
      total_amount: Number(totalAmount),
      currency: items[0]?.currency || "GHS",
      delivery_method: "data_bundle",
      refill_email: email,
      refill_password: deliveryNumbers.join(", "),
      refill_notes: buildGuestCustomerMetadata(customer, items),
    });

    await createOrderEvent(
      order.id,
      "awaiting_payment",
      "Data order created. Waiting for payment.",
    );

    // Notify the customer the order was received and alert the admin team.
    const createdOrder = await getOrderById(order.id);
    if (createdOrder) {
      await sendOrderReceivedEmail(createdOrder);
      await sendAdminAlertEmail(createdOrder, "new_order");
    }

    return res.status(201).json(order);
  } catch (error) {
    console.error("Failed to create data order:", error);
    return res.status(500).json({ message: "Unable to create data order" });
  }
}

function contactsMatch(storedNumbers: string[], contactNumber: string) {
  const normalizedContact = normalizeTrackingNumber(contactNumber);
  if (!normalizedContact) return false;
  return storedNumbers.some((value) => normalizeTrackingNumber(value) === normalizedContact);
}

function remaStatusToLocalStatus(remaStatus: string) {
  const normalized = remaStatus.trim().toLowerCase();
  if (
    normalized.includes("delivered") ||
    normalized.includes("success") ||
    normalized.includes("completed") ||
    normalized.includes("fulfilled") ||
    normalized.includes("fulfil")
  ) {
    return "delivered";
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("cancelled") ||
    normalized.includes("canceled") ||
    normalized.includes("refund") ||
    normalized.includes("error") ||
    normalized.includes("rejected")
  ) {
    return "failed";
  }
  if (
    normalized.includes("paid") ||
    normalized.includes("processing") ||
    normalized.includes("in progress") ||
    normalized.includes("queued") ||
    normalized.includes("active") ||
    normalized.includes("pending")
  ) {
    return "processing";
  }
  return null;
}

export async function trackDataOrderHandler(req: Request, res: Response) {
  try {
    const searchOrderId = String(req.query.orderId || "").trim();
    const searchContactNumber = normalizeTrackingNumber(
      String(req.query.contactNumber || "").trim(),
    );

    // Require BOTH the order ID and the contact number to track an order.
    if (!searchOrderId || !searchContactNumber) {
      return res
        .status(400)
        .json({ message: "Provide both the order ID and contact number to track your order." });
    }

    const parsedOrderNumber = parseOrderReference(searchOrderId);
    if (!parsedOrderNumber) {
      return res.status(400).json({ message: "Enter a valid order ID in the format BRK-XXX-XXX." });
    }

    const [rows] = await pool.query("SELECT * FROM orders WHERE order_number = ? LIMIT 1", [
      parsedOrderNumber,
    ]);
    const order = (rows as OrderRow[])[0] ?? null;

    if (!order) {
      return res.status(404).json({ message: "No matching data order was found." });
    }

    // Verify the contact number matches the order's stored delivery/contact details.
    const guestMetadata = parseGuestMetadata(order);
    const storedNumbers = [
      guestMetadata.contact_number,
      guestMetadata.delivery_number,
      ...guestMetadata.delivery_numbers,
      order.refill_password || "",
    ].filter(Boolean);

    if (!contactsMatch(storedNumbers, searchContactNumber)) {
      return res.status(404).json({
        message: "No matching data order was found for this order ID and contact number.",
      });
    }

    let remaStatusInfo: { status: string; reference: string; message: string; estimatedTime?: string | null } | null = null;
    let remaReference = String(order.fulfillment_reference || "").trim();
    if (!remaReference) {
      const [logRows] = await pool.query(
        "SELECT rema_reference FROM rema_purchase_logs WHERE order_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [order.id],
      );
      remaReference = String((logRows as any[])[0]?.rema_reference || "").trim();
    }
    if (remaReference) {
      remaStatusInfo = await fetchRemaOrderStatus(remaReference);
    }

    // Sync the local order status based on the live Rema status when available.
    if (remaStatusInfo?.status) {
      const localStatus = remaStatusToLocalStatus(remaStatusInfo.status);
      if (localStatus === "delivered" && order.status !== "completed") {
        await updateOrder(order.id, { status: "completed", delivery_status: "delivered" });
        await createOrderEvent(
          order.id,
          "completed",
          `Rema reported delivery: ${remaStatusInfo.message || remaStatusInfo.status}`,
        );
      } else if (localStatus === "failed" && order.status !== "failed") {
        await updateOrder(order.id, { status: "failed", delivery_status: "failed" });
        await createOrderEvent(
          order.id,
          "failed",
          `Rema reported failure: ${remaStatusInfo.message || remaStatusInfo.status}`,
        );
      } else if (
        localStatus === "processing" &&
        order.payment_status === "paid" &&
        order.status !== "processing"
      ) {
        await updateOrder(order.id, { status: "processing", delivery_status: "pending" });
        await createOrderEvent(order.id, "processing", `Rema status: ${remaStatusInfo.status}`);
      }
    }

    const freshOrder = await getOrderById(order.id);
    const orderPayload = serializeTrackedOrder(freshOrder ?? order) as Record<string, unknown>;

    const fulfillmentReference =
      remaStatusInfo?.reference || order.fulfillment_reference || undefined;
    const fulfillmentStatus = remaStatusInfo?.status || undefined;
    const fulfillmentMessage = remaStatusInfo?.message || undefined;

    if (remaStatusInfo?.reference && remaStatusInfo.reference !== order.fulfillment_reference) {
      await updateOrder(order.id, { fulfillment_reference: remaStatusInfo.reference });
    }

    const responsePayload = {
      ...orderPayload,
      fulfillmentReference,
      fulfillmentStatus,
      fulfillmentMessage,
      estimatedTime: remaStatusInfo?.estimatedTime || undefined,
    };

    return res.json({ ok: true, order: responsePayload });
  } catch (error) {
    console.error("Failed to track data order:", error);
    return res.status(500).json({ message: "Unable to track this order right now." });
  }
}

export async function listDataBundlesHandler(req: Request, res: Response) {
  const network = String(req.query.network || "mtn").trim();
  const cacheKey = getCacheKey(network);
  const cached = bundleCache.get(cacheKey);

  if (isDevelopmentMode()) {
    console.log("[Data API] incoming request", {
      path: req.path,
      query: req.query,
      network,
    });
  }

  if (cached && cached.expiresAt > Date.now()) {
    return res.json(cached.value);
  }

  const baseUrl =
    process.env.REMA_API_BASE_URL || process.env.REMA_BASE_URL || "https://remadata.com/api";
  const apiKey = process.env.REMA_API_KEY || process.env.REMA_API_TOKEN || "";

  const normalizedNetwork = network.toLowerCase().replace(/\s+/g, "");

  const networkValue =
    normalizedNetwork === "airteltigo" ||
    normalizedNetwork === "airtel" ||
    normalizedNetwork === "airtel-tigo"
      ? "airteltigo"
      : normalizedNetwork === "telecel" ||
          normalizedNetwork === "telex" ||
          normalizedNetwork === "tigo"
        ? "telecel"
        : normalizedNetwork === "mtn"
          ? "mtn"
          : network;

  try {
    if (!apiKey) {
      bundleCache.set(cacheKey, { expiresAt: Date.now() + BUNDLE_CACHE_TTL_MS, value: [] });
      return res.status(503).json({
        message:
          "Out of Stock\n\nNo data bundles are available at the moment. Please check back later. We restock regularly and our service is available 24/7.",
      });
    }

    const bundlesUrl = String(
      process.env.REMA_API_BUNDLES_URL || process.env.REMA_API_LIST_URL || "",
    ).trim();
    const endpoint =
      bundlesUrl ||
      `${baseUrl.replace(/\/+$/, "")}${String(process.env.REMA_API_BUNDLES_PATH || "/bundles").trim()}`;
    const requestUrl = new URL(endpoint);
    requestUrl.searchParams.set("network", networkValue);

    const remaHeaderName = getRemaApiHeaderName();
    logRemaDebug("list-bundles request", {
      requestUrl: requestUrl.toString(),
      method: "GET",
      network: networkValue,
      apiKeyLoaded: Boolean(apiKey),
      apiHeaderName: remaHeaderName,
    });
    if (isDevelopmentMode()) {
      console.log("[Data API] Rema endpoint called", {
        method: "GET",
        endpoint: requestUrl.toString(),
        network: networkValue,
        apiKeyLoaded: Boolean(apiKey),
        apiHeaderName: remaHeaderName,
      });
    }

    const response = await fetch(requestUrl.toString(), {
      method: "GET",
      headers: buildRemaHeaders(apiKey),
    });

    const responseText = await response.text().catch(() => "");
    let payload: any = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        logRemaParseError("list-bundles", error);
      }
    }

    if (isDevelopmentMode()) {
      console.log("[Data API] Rema response status", { status: response.status });
      console.log("[Data API] Rema response body", payload ?? responseText);
    }

    logRemaDebug("list-bundles response", {
      requestUrl: requestUrl.toString(),
      method: "GET",
      network: networkValue,
      status: response.status,
      body: payload ?? responseText,
      apiKeyLoaded: Boolean(apiKey),
    });

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        "Out of Stock\n\nNo data bundles are available at the moment. Please check back later. We restock regularly and our service is available 24/7.";
      if (isDevelopmentMode()) {
        console.error("[Data API] Rema request failed", { status: response.status, message });
      }
      bundleCache.set(cacheKey, { expiresAt: Date.now() + BUNDLE_CACHE_TTL_MS, value: [] });
      return res.status(503).json({ message });
    }

    const bundles = extractBundles(payload, networkValue);
    const normalized = bundles.filter((item) => Number(item.price) >= 0);
    const pricedBundles = normalized.map((item) => ({
      ...item,
    }));

    bundleCache.set(cacheKey, {
      expiresAt: Date.now() + BUNDLE_CACHE_TTL_MS,
      value: pricedBundles,
    });

    if (isDevelopmentMode()) {
      console.log("[Data API] returning normalized bundles", {
        count: pricedBundles.length,
        network: networkValue,
      });
    }

    return res.json(pricedBundles);
  } catch (error) {
    console.error("Failed to load Rema bundles:", error);
    bundleCache.set(cacheKey, { expiresAt: Date.now() + BUNDLE_CACHE_TTL_MS, value: [] });
    return res.status(503).json({
      message:
        "Out of Stock\n\nNo data bundles are available at the moment. Please check back later. We restock regularly and our service is available 24/7.",
    });
  }
}
