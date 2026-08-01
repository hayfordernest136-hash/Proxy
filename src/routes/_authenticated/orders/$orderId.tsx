import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { OrderTimeline } from "@/components/site/OrderTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Details — Brokeflex Data" },
      { name: "description", content: "Live status, timeline and delivery for your proxy order." },
      { property: "og:title", content: "Order Details — Brokeflex Data" },
      { property: "og:description", content: "Live status and delivery for your proxy order." },
    ],
  }),
  component: OrderDetailPage,
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    refetchInterval: 15000,
    queryFn: async () => {
      return await apiFetch<any>(`/api/orders/${orderId}`);
    },
  });

  const { data: events } = useQuery({
    queryKey: ["order-events", orderId],
    refetchInterval: 15000,
    queryFn: async () => {
      return await apiFetch<any[]>(`/api/orders/${orderId}/events`);
    },
  });

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-12 sm:px-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </SiteLayout>
    );
  }

  if (!order) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">Order not found</h1>
          <Button asChild className="mt-6">
            <Link to="/orders">Back to orders</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  const status = order.status as OrderStatus;
  const delivery = order.delivery_method as DeliveryMethod;
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);

  useEffect(() => {
    if (
      order &&
      (status === "cancelled" || status === "refunded") &&
      order.support_message_unread
    ) {
      setSupportDialogOpen(true);
    }
  }, [order, status]);

  async function markSupportMessageRead() {
    if (!order) return;
    try {
      await apiFetch(`/api/orders/${order.id}/support-message/read`, {
        method: "POST",
      });
      await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    } catch (error) {
      console.error('Unable to mark support message read:', error);
    }
  }

  async function copyKey() {
    if (!order?.cd_key) return;
    await navigator.clipboard.writeText(order.cd_key);
    setCopied(true);
    toast.success("CD key copied");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-12 sm:px-6">
        <nav className="text-sm text-muted-foreground">
          <Link to="/orders" className="hover:text-foreground">
            Orders
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">#{order.order_number}</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">
            Order #{order.order_number}
          </h1>
          <Badge variant="outline" className={statusTone(status)}>
            {ORDER_STATUS_LABEL[status]}
          </Badge>
        </div>

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-sm">{ORDER_STATUS_MESSAGE[status]}</p>
            {!["completed", "cancelled", "refunded"].includes(status) ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Estimated delivery: {DELIVERY_ETA[delivery]}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {order.payment_status === "unpaid" ? (
          <Card className="border-warning/40 bg-warning/10">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm">This order has not been paid yet.</p>
              <Button asChild size="sm">
                <Link to="/checkout/$orderId" params={{ orderId: order.id }}>
                  Complete payment
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {status === "completed" && delivery === "cd_key" && order.cd_key ? (
          <Card className="border-success/40 bg-success/10">
            <CardContent className="space-y-3 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="size-4" /> Your CD Key
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <code className="rounded-lg border border-border/60 bg-background px-4 py-2 font-mono text-base tracking-widest">
                  {order.cd_key}
                </code>
                <Button size="sm" variant="secondary" onClick={copyKey}>
                  {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
                  Copy key
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {status === "completed" && delivery === "account_refill" ? (
          <Card className="border-success/40 bg-success/10">
            <CardContent className="p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <RefreshCw className="size-4" /> Account activation completed.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account {order.refill_email ? `(${order.refill_email})` : ""} has been
                refilled and is ready to use.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {order.refill_proof_url ? (
          <Card className="border-border/70">
            <CardContent className="p-5">
              <h3 className="font-medium">Refill proof</h3>
              <div className="mt-3">
                <img src={order.refill_proof_url} alt="Refill proof" className="max-w-full rounded" />
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/70">
            <CardContent className="p-6">
              <h2 className="font-semibold tracking-tight">Order summary</h2>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ["Product", order.product_name],
                  ["Plan", order.plan_name],
                  ["Proxy type", order.proxy_type ?? "—"],
                  ["Quantity", String(order.quantity)],
                  ["Delivery method", DELIVERY_LABEL[delivery]],
                  ["Unit price", formatMoney(order.unit_price, order.currency)],
                  ["Total paid", formatMoney(order.total_amount, order.currency)],
                  ["Payment", order.payment_status === "paid" ? "Paid" : "Unpaid"],
                  ["Placed", formatDate(order.created_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="p-6">
              <h2 className="font-semibold tracking-tight">Progress</h2>
              <div className="mt-5">
                <OrderTimeline status={status} />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{DELIVERY_DISCLAIMER}</p>
            </CardContent>
          </Card>
        </div>

        {order.admin_notes ? (
          <Card className="border-border/70">
            <CardContent className="p-6">
              <h2 className="font-semibold tracking-tight">Message from support</h2>
              <p className="mt-2 text-sm text-muted-foreground">{order.admin_notes}</p>
            </CardContent>
          </Card>
        ) : null}

        <AlertDialog open={supportDialogOpen} onOpenChange={async (open) => {
          if (!open) {
            await markSupportMessageRead();
          }
          setSupportDialogOpen(open);
        }}>
          <AlertDialogContent className="max-w-3xl rounded-[2rem] p-10 text-center sm:p-12">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                  Order #{order.order_number}
                </p>
                <AlertDialogTitle className="text-3xl font-extrabold">
                  {status === "cancelled" ? "Order Cancelled" : "Refund Issued"}
                </AlertDialogTitle>
                <AlertDialogDescription className="mx-auto max-w-2xl text-lg font-semibold leading-8 text-foreground">
                  {order.admin_notes || ORDER_STATUS_MESSAGE[status]}
                </AlertDialogDescription>
              </div>
              <AlertDialogAction asChild>
                <Button size="lg" className="w-full">
                  Close
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        {events?.length ? (
          <Card className="border-border/70">
            <CardContent className="p-6">
              <h2 className="font-semibold tracking-tight">Activity</h2>
              <ul className="mt-4 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">
                        {ORDER_STATUS_LABEL[e.status as OrderStatus]}
                      </span>{" "}
                      <span className="text-muted-foreground">{e.message}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(e.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </SiteLayout>
  );
}
