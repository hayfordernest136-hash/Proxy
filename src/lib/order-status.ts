export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "purchasing_proxy"
  | "delivering"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

export type DeliveryMethod = "cd_key" | "account_refill" | "data_bundle";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
  processing: "Processing",
  purchasing_proxy: "Purchasing Proxy",
  delivering: "Delivering",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

export const ORDER_STATUS_MESSAGE: Record<OrderStatus, string> = {
  awaiting_payment: "Your order has been created and is waiting for payment.",
  paid: "We have received your payment successfully.",
  processing: "We have received your order and are working on it.",
  purchasing_proxy:
    "We have received your payment and are currently purchasing your proxy.",
  delivering: "Your proxy is being delivered right now.",
  completed: "Your order has been completed. Enjoy your service.",
  cancelled: "This order was cancelled.",
  refunded: "This order was refunded.",
  failed: "There was an issue fulfilling your order. Please contact support.",
};

/** Ordered timeline shown to customers. */
export const TIMELINE_STEPS: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "processing",
  "purchasing_proxy",
  "delivering",
  "completed",
];

export const TIMELINE_LABEL: Record<string, string> = {
  awaiting_payment: "Order placed",
  paid: "Payment received",
  processing: "Processing",
  purchasing_proxy: "Purchasing proxy",
  delivering: "Delivering",
  completed: "Completed",
};

export const DELIVERY_LABEL: Record<DeliveryMethod, string> = {
  cd_key: "CD Key",
  account_refill: "Account Refill",
  data_bundle: "Data bundle",
};

export const DELIVERY_ETA: Record<DeliveryMethod, string> = {
  cd_key: "Usually within 2 minutes after payment",
  account_refill: "Usually within 5-7 minutes after payment",
  data_bundle: "Usually within 5-10 minutes after payment",
};

export const DELIVERY_DISCLAIMER =
  "Delivery times are estimates and may vary during periods of high demand or maintenance.";

export function statusTone(status: OrderStatus) {
  switch (status) {
    case "completed":
      return "bg-success/15 text-success border-success/30";
    case "cancelled":
    case "refunded":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "awaiting_payment":
      return "bg-warning/15 text-warning border-warning/30";
    default:
      return "bg-primary/15 text-primary border-primary/30";
  }
}
