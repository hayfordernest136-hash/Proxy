import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clipboard, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/site/AdminLayout";
import { OrderTimeline } from "@/components/site/OrderTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  DELIVERY_DISCLAIMER,
  DELIVERY_ETA,
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_MESSAGE,
  statusTone,
  type DeliveryMethod,
  type OrderStatus,
} from "@/lib/order-status";

const STATUS_OPTIONS: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "processing",
  "purchasing_proxy",
  "delivering",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];

export const Route = createFileRoute("/_authenticated/admin/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Admin Order Details - BrokeFlex Data" },
      { name: "description", content: "Admin order details, timeline, and fulfillment controls." },
    ],
  }),
  component: AdminOrderDetailPage,
});

interface AdminOrder {
  id: number;
  order_number: number;
  user_id: number | null;
  product_id: number | null;
  plan_id: number | null;
  product_name: string;
  plan_name: string;
  proxy_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  delivery_method: DeliveryMethod;
  customer_email: string | null;
  customer_name: string | null;
  order_type: string | null;
  refill_email: string | null;
  refill_password: string | null;
  refill_notes: string | null;
  status: OrderStatus;
  payment_status: string;
  support_message_unread: number;
  payment_reference: string | null;
  payment_provider: string | null;
  referral_discount_applied: number;
  cd_key: string | null;
  admin_notes: string | null;
  refill_proof_url: string | null;
  delivery_status: string | null;
  fulfillment_reference: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderEvent {
  id: number;
  order_id: number;
  status: string;
  message: string;
  created_at: string;
}

interface RemaStatusInfo {
  status: string;
  reference: string;
  message: string;
  clientReference: string;
  providerReference: string;
  providerName: string;
  providerStatus: string;
  providerMessage: string;
  apiStatus: number;
  walletCharge: string;
  refunded: boolean;
  updatedAt: string;
}

function formatOrderReference(orderNumber: number) {
  const digits = String(orderNumber).padStart(6, '0');
  return `BRK-${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function parseDataOrderMetadata(order: AdminOrder) {
  let parsed: any = {};
  if (order.refill_notes) {
    try {
      parsed = typeof order.refill_notes === 'string' ? JSON.parse(order.refill_notes) : order.refill_notes;
    } catch {
      parsed = {};
    }
  }

  return {
    customerName: String(parsed?.full_name || parsed?.customer_name || order.customer_name || '').trim(),
    customerEmail: String(parsed?.email || order.customer_email || '').trim(),
    contactNumber: String(parsed?.contact_number || '').trim(),
    network: String(parsed?.network || order.proxy_type || '').trim(),
    bundleName: String(parsed?.bundle || parsed?.bundles?.[0] || order.plan_name || order.product_name || '').trim(),
    bundleSize: String(parsed?.bundle || order.plan_name || '').trim(),
    volumeInMb: parsed?.volume_in_mb ?? parsed?.volumeInMB ?? null,
    deliveryNumber: String(parsed?.delivery_number || parsed?.deliveryNumber || order.refill_password || '').trim(),
  };
}

function displayValue(value: string | number | boolean | null | undefined) {
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value === undefined || value === null || String(value).trim() === '') {
    return 'Waiting for provider...';
  }
  return String(value);
}

function AdminOrderDetailPage() {
  const { orderId } = Route.useParams();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>("processing");
  const [adminNote, setAdminNote] = useState("");
  const [cdKey, setCdKey] = useState("");
  const [refillProofUrl, setRefillProofUrl] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState<string>("pending");
  const [isSaving, setIsSaving] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: async () => await apiFetch<AdminOrder>(`/api/admin/orders/${orderId}`),
  });

  const isDataOrder = order?.delivery_method === "data_bundle" || order?.order_type === "data";
  const isProxyOrder = !isDataOrder;

  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ["admin-order-events", orderId],
    queryFn: async () => await apiFetch<OrderEvent[]>(`/api/orders/${orderId}/events`),
    enabled: Boolean(order),
    refetchInterval: 15000,
  });

  const { data: remaStatus, isFetching: isRemaFetching, refetch: refetchRemaStatus } = useQuery({
    queryKey: ["admin-order-rema-status", orderId],
    queryFn: async () => await apiFetch<RemaStatusInfo>(`/api/admin/orders/${orderId}/rema-status`),
    enabled: Boolean(order?.fulfillment_reference && isDataOrder),
    refetchInterval: order?.fulfillment_reference && isDataOrder ? 15000 : false,
  });

  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
      setAdminNote(order.admin_notes ?? "");
      setCdKey(order.cd_key ?? "");
      setRefillProofUrl(order.refill_proof_url ?? "");
      setDeliveryStatus(order.delivery_status ?? "pending");
    }
  }, [order]);

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      status: string;
      admin_notes: string | null;
      cd_key?: string | null;
      refill_proof_url?: string | null;
      delivery_status?: string | null;
    }) =>
      await apiFetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-order-events", orderId] });
      toast.success("Order updated successfully.");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to update order.";
      toast.error(message);
    },
    onSettled: () => {
      setIsSaving(false);
    },
  });

  const canFetchRema = Boolean(order?.fulfillment_reference);
  const dataMetadata = order && isDataOrder ? parseDataOrderMetadata(order) : null;

  async function handleSave() {
    if (!order) return;
    setIsSaving(true);
    await updateMutation.mutateAsync({
      status: selectedStatus,
      admin_notes: adminNote || null,
      cd_key: cdKey || null,
      refill_proof_url: refillProofUrl || null,
      delivery_status: deliveryStatus || null,
    });
  }

  const summaryItems = useMemo(() => {
    if (!order) return [] as Array<[string, string]>;
    return [
      ["Order #", String(order.order_number)],
      ["Customer", order.customer_email ?? "Guest"],
      ["Proxy type", order.proxy_type || "-"],
      ["Delivery method", DELIVERY_LABEL[order.delivery_method]],
      ["Payment status", order.payment_status === "paid" ? "Paid" : "Unpaid"],
      ["Quantity", String(order.quantity)],
      ["Unit price", formatMoney(order.unit_price, order.currency)],
      ["Total amount", formatMoney(order.total_amount, order.currency)],
      ["Placed", formatDate(order.created_at)],
      ["Updated", formatDate(order.updated_at)],
    ];
  }, [order]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">Order not found</h1>
          <Button asChild className="mt-6">
            <Link to="/admin/orders">Back to orders</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const status = order.status as OrderStatus;
  const delivery = order.delivery_method as DeliveryMethod;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted px-3 py-1 text-sm text-muted-foreground">
              <ArrowLeft className="size-4" />
              <Link to="/admin/orders" className="font-medium text-foreground hover:text-primary">
                Back to orders
              </Link>
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Orders</p>
              <h1 className="text-3xl font-bold tracking-tight">Order #{order.order_number}</h1>
            </div>
          </div>
          <Badge variant="outline" className={statusTone(status)}>
            {ORDER_STATUS_LABEL[status]}
          </Badge>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card className="border-border/70">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Order details</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Full metadata and fulfillment information for this order.</p>
                  </div>
                  <Badge className={statusTone(status)} variant="outline">
                    {ORDER_STATUS_LABEL[status]}
                  </Badge>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {summaryItems.map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                      <p className="mt-2 font-medium">{value}</p>
                    </div>
                  ))}
                  {isDataOrder ? (
                    <>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">BrokeFlex Order ID</p>
                        <p className="mt-2 font-medium">{formatOrderReference(order.order_number)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Internal Database ID</p>
                        <p className="mt-2 font-medium">{order.id}</p>
                      </div>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">Timeline</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Order progress and fulfillment events.</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void refetchEvents()}>
                    Refresh activity
                  </Button>
                </div>
                <div className="mt-6">
                  <OrderTimeline status={status} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">{DELIVERY_DISCLAIMER}</p>
              </CardContent>
            </Card>

            {order.delivery_method === "cd_key" && order.cd_key ? (
              <Card className="border-success/40 bg-success/10">
                <CardContent className="space-y-3 p-6">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Clipboard className="size-4" /> CD key assigned
                  </p>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4 font-mono">
                    {order.cd_key}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {order.refill_proof_url ? (
              <Card className="border-border/70">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold">Refill proof</h2>
                  <p className="mt-2 text-sm text-muted-foreground">Uploaded evidence for this delivery.</p>
                  <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
                    <img src={order.refill_proof_url} alt="Refill proof" className="h-full w-full object-cover" />
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/70">
              <CardContent className="space-y-4 p-6">
                <div>
                  <h2 className="text-lg font-semibold">Customer & fulfillment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Review the contact fields and order metadata.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer email</p>
                    <p className="mt-2 font-medium">{isDataOrder ? displayValue(dataMetadata?.customerEmail) : order.customer_email ?? "Guest"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer name</p>
                    <p className="mt-2 font-medium">{isDataOrder ? displayValue(dataMetadata?.customerName) : order.customer_name ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Customer phone</p>
                    <p className="mt-2 font-medium">{isDataOrder ? displayValue(dataMetadata?.contactNumber) : order.refill_email ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Delivery number</p>
                    <p className="mt-2 font-medium">{isDataOrder ? displayValue(dataMetadata?.deliveryNumber) : order.refill_password ?? "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {order.admin_notes ? (
              <Card className="border-border/70">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold">Admin notes</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{order.admin_notes}</p>
                </CardContent>
              </Card>
            ) : null}
            {isDataOrder ? (
              <Card className="border-border/70">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="text-lg font-semibold">Data bundle details</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Bundle-level metadata for this order.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Network</p>
                      <p className="mt-2 font-medium">{displayValue(dataMetadata?.network)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bundle name</p>
                      <p className="mt-2 font-medium">{displayValue(dataMetadata?.bundleName)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bundle size</p>
                      <p className="mt-2 font-medium">{displayValue(dataMetadata?.bundleSize)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Volume in MB</p>
                      <p className="mt-2 font-medium">{displayValue(dataMetadata?.volumeInMb)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Amount paid</p>
                      <p className="mt-2 font-medium">{formatMoney(order.total_amount, order.currency)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            {isProxyOrder ? (
              <Card className="border-border/70">
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Admin actions</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Update status, add CD key/refill proof, or record a note for support.</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => refetchEvents()}>
                      Refresh activity
                    </Button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                      <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as OrderStatus)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {ORDER_STATUS_LABEL[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Admin note</p>
                      <Textarea
                        value={adminNote}
                        onChange={(event) => setAdminNote(event.target.value)}
                        placeholder="Add an internal note for this order"
                        className="min-h-[120px] w-full"
                      />
                    </div>

                    {isProxyOrder ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="cd-key">CD Key</Label>
                          <Input
                            id="cd-key"
                            value={cdKey}
                            onChange={(event) => setCdKey(event.target.value)}
                            placeholder="Enter CD key to deliver"
                          />
                          <p className="mt-2 text-sm text-muted-foreground">
                            Adding a CD key here will ensure the customer can receive it by email if the order is completed.
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="delivery-status">Delivery status</Label>
                          <Input
                            id="delivery-status"
                            value={deliveryStatus}
                            onChange={(event) => setDeliveryStatus(event.target.value)}
                            placeholder="pending / delivered"
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <Button size="lg" onClick={handleSave} disabled={isSaving || updateMutation.isPending}>
                        {isSaving || updateMutation.isPending ? "Saving..." : "Save changes"}
                      </Button>
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Proxy orders can be moved through fulfillment states manually.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {isDataOrder ? (
              <Card className="border-border/70">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Rema fulfillment status</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Live status fetch for data orders using the fulfillment reference.
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void refetchRemaStatus()} disabled={!canFetchRema || isRemaFetching}>
                      <RefreshCw className="size-4" />
                      Refresh
                    </Button>
                  </div>

                  {order.fulfillment_reference ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fulfillment reference</p>
                        <p className="mt-2 font-medium">{displayValue(order.fulfillment_reference)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rema status</p>
                        <p className="mt-2 font-medium">{displayValue(remaStatus?.status)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                      No fulfillment reference is available for this data order yet.
                    </div>
                  )}

                  {remaStatus?.message ? (
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rema message</p>
                      <p className="mt-2">{displayValue(remaStatus.message)}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {isDataOrder ? (
              <Card className="border-border/70">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Rema Data Information</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Live Rema order information for data bundle fulfillment.
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => void refetchRemaStatus()} disabled={!canFetchRema || isRemaFetching}>
                      <RefreshCw className="size-4" />
                      Refresh Status
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rema Data Reference</p>
                      <p className="mt-2 font-medium">{displayValue(order.fulfillment_reference)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Rema Order Reference</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.reference)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Client Reference</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.clientReference)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provider Reference</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.providerReference)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provider Name</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.providerName)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provider Status</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.providerStatus)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 sm:col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Provider Message</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.providerMessage)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">API Response Status</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.apiStatus)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Last API Sync</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.updatedAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Wallet Charge</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.walletCharge)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Refunded</p>
                      <p className="mt-2 font-medium">{displayValue(remaStatus?.refunded)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/70">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Event activity</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Chronological events for this order.</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => void refetchEvents()}>
                    Refresh
                  </Button>
                </div>

                <div className="mt-6 space-y-3">
                  {eventsLoading ? (
                    <Skeleton className="h-12 rounded-xl" />
                  ) : events?.length ? (
                    events.map((event) => (
                      <div key={event.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium">{ORDER_STATUS_LABEL[event.status as OrderStatus] ?? event.status}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(event.created_at)}</p>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{event.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No events were recorded for this order.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
