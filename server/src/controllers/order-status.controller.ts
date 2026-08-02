import { Request, Response } from "express";
import {
  getOrderByFulfillmentReference,
  updateOrder,
  getOrderById,
  createOrderEvent,
} from "../services/order.service";
import {
  getRemaApiBaseUrl,
  getRemaApiHeaderName,
  getRemaApiKey,
  logRemaDebug,
  remaStatusToLocalStatus,
} from "./admin.controller";

export async function getOrderStatusHandler(req: Request, res: Response) {
  try {
    const reference = String(req.params.reference || "").trim();
    if (!reference) {
      return res.status(400).json({ message: "Missing order reference" });
    }

    const order = await getOrderByFulfillmentReference(reference);
    if (!order) {
      return res.status(404).json({ message: "Order not found for this reference" });
    }

    const statusInfo = await fetchRemaOrderStatus(reference);
    if (!statusInfo) {
      return res.status(502).json({ message: "Unable to fetch status from Rema" });
    }

    const localStatus = remaStatusToLocalStatus(statusInfo.status);
    if (localStatus && localStatus !== order.status) {
      await updateOrder(order.id, {
        status: localStatus,
        delivery_status: localStatus === "completed" ? "delivered" : order.delivery_status,
      });
      await createOrderEvent(
        order.id,
        localStatus,
        `Live status sync from Rema: ${statusInfo.status}`,
      );
    }

    const refreshedOrder = await getOrderById(order.id);
    return res.json({ order: refreshedOrder, rema: statusInfo });
  } catch (error) {
    console.error("Failed to fetch order status:", error);
    return res.status(500).json({ message: "Unable to fetch order status" });
  }
}

async function fetchRemaOrderStatus(reference: string) {
  const apiKey = getRemaApiKey();
  if (!reference) {
    return null;
  }

  try {
    const endpoint = `${getRemaApiBaseUrl().replace(/\/+$/, "")}/order-status/${encodeURIComponent(reference)}`;
    logRemaDebug("order-status-request", { endpoint });

    const response = await fetch(endpoint, {
      method: "GET",
      headers: buildRemaHeaders(apiKey),
    });

    const text = await response.text().catch(() => "");
    let payload: any = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch (error) {
        logRemaDebug("order-status-parse-error", { error: String(error), text });
      }
    }

    if (!response.ok) {
      return null;
    }

    const data = payload?.data ?? payload;
    return {
      status: String(data?.status ?? payload?.status ?? "").trim(),
      reference: String(
        data?.reference ??
          data?.rema_reference ??
          data?.order_reference ??
          payload?.reference ??
          payload?.rema_reference ??
          payload?.order_reference ??
          "",
      ).trim(),
      message: String(payload?.message ?? data?.message ?? "").trim(),
      clientReference: String(data?.client_reference ?? payload?.client_reference ?? "").trim(),
      providerReference: String(
        data?.provider_reference ?? payload?.provider_reference ?? "",
      ).trim(),
      providerName: String(data?.provider_name ?? payload?.provider_name ?? "").trim(),
      providerStatus: String(data?.provider_status ?? payload?.provider_status ?? "").trim(),
      providerMessage: String(data?.provider_message ?? payload?.provider_message ?? "").trim(),
      apiStatus: response.status,
      walletCharge: String(data?.wallet_charge ?? payload?.wallet_charge ?? "").trim(),
      refunded: Boolean(data?.refunded ?? payload?.refunded ?? false),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logRemaDebug("order-status-error", { error: String(error) });
    return null;
  }
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
    };
  }

  return {
    "Content-Type": "application/json",
    [apiHeaderName]: apiKey,
  };
}
