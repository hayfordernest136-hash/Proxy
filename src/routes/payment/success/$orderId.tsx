import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Copy, Download, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { DELIVERY_ETA, DELIVERY_LABEL, type DeliveryMethod } from "@/lib/order-status";

export const Route = createFileRoute("/payment/success/$orderId")({
  validateSearch: (search: Record<string, unknown>) => ({
    reference: typeof search.reference === "string" ? search.reference : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment Successful - BrokeFlex" },
      {
        name: "description",
        content: "Your payment was verified securely and your order is now being prepared.",
      },
    ],
  }),
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  const { orderId } = Route.useParams();
  const search = Route.useSearch();
  const [order, setOrder] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConfirmation() {
      setLoading(true);
      setError(null);

      try {
        await apiFetch("/api/payments/confirm", {
          method: "POST",
          body: JSON.stringify({ orderId, reference: search.reference }),
        });

        const confirmationData = await apiFetch<any>(
          `/api/payments/confirmation/${orderId}${search.reference ? `?reference=${encodeURIComponent(search.reference)}` : ""}`,
        );

        if (!cancelled) {
          setOrder(confirmationData);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load your payment confirmation.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConfirmation();

    return () => {
      cancelled = true;
    };
  }, [orderId, search.reference]);

  async function copyReference() {
    if (!order?.payment_reference) return;
    await navigator.clipboard.writeText(order.payment_reference);
    setCopied(true);
    toast.success("Payment reference copied.");
    setTimeout(() => setCopied(false), 2000);
  }

  async function printInvoice() {
    window.print();
  }

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <Skeleton className="h-80 rounded-[2rem]" />
        </div>
      </SiteLayout>
    );
  }

  if (error || !order) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-3xl font-semibold">We could not load this confirmation</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {error || "The order details for this payment could not be verified yet."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/orders">Browse your orders</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/support">Contact support</Link>
            </Button>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const isDataOrder = order.delivery_method === "data_bundle" || order.product_name?.toLowerCase().includes("data");
  const delivery = (order.delivery_method || "cd_key") as DeliveryMethod;
  const deliveryLabel = DELIVERY_LABEL[delivery] || "Standard delivery";
  const deliveryEta = (order as any).estimated_time || DELIVERY_ETA[delivery] || "Processing";
  const formattedOrderRef = (() => {
    const num = order.order_number ?? order.id ?? "";
    const digits = String(num).padStart(6, "0");
    return `BRK-${digits.slice(0, 3)}-${digits.slice(3)}`;
  })();

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/12 via-background to-background p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                <CheckCircle2 className="size-4" />
                Payment successful
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                  Thank you for your order.
                </h1>
                <p className="text-base text-muted-foreground">
                  Your payment was verified securely on our servers and your order is now being prepared.
                  We will keep your updates live here as fulfilment progresses.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/90 p-4 text-sm shadow-sm">
              <p className="font-semibold">Order #{order.order_number}</p>
              <p className="mt-1 text-muted-foreground">Placed {formatDate(order.created_at)}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                <ShieldCheck className="size-3.5" />
                Securely verified payment
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Order summary</p>
                  <h2 className="text-xl font-semibold">{order.product_name || "Order"}</h2>
                </div>
                <Badge variant="secondary" className="rounded-full px-3 py-1">
                  {order.payment_status === "paid" ? "Paid" : "Processing"}
                </Badge>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="size-4 text-primary" />
                  {isDataOrder ? "Your data bundle is being prepared" : "Your order is being prepared"}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isDataOrder
                    ? "We are processing the provider request and will update the live fulfillment details as soon as they are available."
                    : "We are now moving your order through the fulfilment pipeline and will keep the status live for you."}
                </p>
              </div>

              <dl className="space-y-3 text-sm">
                {[
                  ["Plan", order.plan_name || "-"],
                  ["Quantity", String(order.quantity || 1)],
                  ["Delivery method", deliveryLabel],
                  ["Estimated timing", deliveryEta],
                  ["Total paid", formatMoney(order.total_amount, order.currency)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {isDataOrder ? (
                <div className="rounded-2xl border border-border/70 bg-muted/5 p-4 text-sm">
                  <p className="font-semibold">Delivery details</p>
                  <div className="mt-3 space-y-2 text-muted-foreground">
                    <p>
                      Contact: {order.data_metadata?.contact_number || order.customer_name || "-"}
                    </p>
                    <p>
                      Delivery number: {order.data_metadata?.delivery_number || "-"}
                    </p>
                    <p>
                      Order ID: {formattedOrderRef}
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-primary">Payment details</p>
                <h2 className="text-xl font-semibold">Everything is ready</h2>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/5 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{order.payment_reference || "Pending"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Payment method</span>
                  <span className="font-medium">{order.payment_method || "Secure card"}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={copyReference} variant="outline" className="flex-1">
                  <Copy className="mr-2 size-4" />
                  {copied ? "Copied" : "Copy reference"}
                </Button>
                <Button onClick={printInvoice} variant="secondary" className="flex-1">
                  <Download className="mr-2 size-4" />
                  Download invoice
                </Button>
              </div>

              <div className="space-y-3">
                <Button asChild className="w-full">
                  <Link to="/orders/$orderId" params={{ orderId: order.id }}>
                    View order details
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/support">
                    <Headphones className="mr-2 size-4" />
                    Contact support
                  </Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success-foreground">
                <p className="font-semibold">Protected and verified</p>
                <p className="mt-1 text-sm opacity-90">
                  Your order remains secure and we only expose your details after payment confirmation.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteLayout>
  );
}
