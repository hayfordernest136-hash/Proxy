import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { calculatePaystackFee } from "@/lib/paystack-fee";
import { DELIVERY_ETA, DELIVERY_LABEL, type DeliveryMethod } from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/checkout/$orderId")({
  head: () => ({
    meta: [
      { title: "Secure Checkout - BrokeFlex" },
      { name: "description", content: "Complete payment to start fulfillment of your proxy order." },
      { property: "og:title", content: "Secure Checkout - BrokeFlex" },
      { property: "og:description", content: "Complete payment for your proxy order." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      return await apiFetch<any>(`/api/orders/${orderId}`);
    },
  });

  async function handleApplyReward() {
    setBusy(true);
    try {
      const updatedOrder = await apiFetch<any>(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ apply_referral_discount: true }),
      });
      setDiscountApplied(true);
      toast.success('Referral reward applied. Your order total has been updated.');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to apply referral reward.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    setBusy(true);
    try {
      const response = await apiFetch<{ ok: boolean; authorizationUrl?: string; reference?: string; sandbox?: boolean }>(
        "/api/payments/initiate",
        {
          method: "POST",
          body: JSON.stringify({ orderId }),
        },
      );

      if (response.sandbox) {
        toast.success("Sandbox payment initiated. Confirming order as paid.");
        navigate({ to: "/orders/$orderId", params: { orderId } });
        return;
      }

      if (!response.authorizationUrl) {
        throw new Error("Unable to start payment flow.");
      }

      window.location.href = response.authorizationUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!order) return;
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref') || params.get('trxRef');
    if (!reference) return;
    if (order.payment_status === 'paid') {
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    async function confirmRedirectedPayment() {
      setBusy(true);
      try {
        await apiFetch<{ ok: boolean }>("/api/payments/confirm", {
          method: "POST",
          body: JSON.stringify({ orderId, reference }),
        });
        toast.success("Payment confirmed - fulfillment has started.");
        navigate({ to: "/orders/$orderId", params: { orderId } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Unable to confirm payment.");
      } finally {
        setBusy(false);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }

    confirmRedirectedPayment();
  }, [order, orderId, navigate]);

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </SiteLayout>
    );
  }

  if (!order) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">Order not found</h1>
          <Button asChild className="mt-6">
            <Link to="/products">Browse proxies</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  const paid = order.payment_status === "paid";
  const delivery = order.delivery_method as DeliveryMethod;
  const hasEligibleReward = order.quantity === 10 && !order.referral_discount_applied && order.status !== 'paid';
  const { fee: paystackFee, total: paystackTotal } = calculatePaystackFee(Number(order.total_amount));

  return (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
        <p className="mt-1 text-muted-foreground">Order #{order.order_number}</p>

        <Card className="mt-8 border-border/70">
          <CardContent className="space-y-5 p-6">
            <dl className="space-y-3 text-sm">
              {[
                ["Product", order.product_name],
                ["Plan", order.plan_name],
                ["Quantity", String(order.quantity)],
                ["Delivery method", DELIVERY_LABEL[delivery]],
                ["Estimated delivery", DELIVERY_ETA[delivery]],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/5 p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span>Product Price</span>
                <span className="font-medium">{formatMoney(order.total_amount, order.currency)}</span>
              </div>
              <div className="flex justify-between gap-4 text-sm">
                <span>Paystack Processing Fee</span>
                <span className="font-medium">{formatMoney(paystackFee, order.currency)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-border/70 pt-3 text-sm font-semibold">
                <span>Total to Pay</span>
                <span>{formatMoney(paystackTotal, order.currency)}</span>
              </div>
            </div>

            {hasEligibleReward ? (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm text-primary">
                You have an unused referral reward. Apply 50% off to this 10 IP proxy package.
              </div>
            ) : null}

            {paid ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-success">This order is already paid.</p>
                <Button asChild className="w-full">
                  <Link to="/orders/$orderId" params={{ orderId }}>
                    Track your order
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {hasEligibleReward ? (
                  <Button
                    className="w-full"
                    variant="secondary"
                    size="lg"
                    onClick={handleApplyReward}
                    disabled={busy}
                  >
                    {busy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Apply 50% referral reward
                  </Button>
                ) : null}
                <Button className="w-full" size="lg" onClick={handlePay} disabled={busy}>
                  {busy ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 size-4" />
                  )}
                  Pay {formatMoney(paystackTotal, order.currency)}
                </Button>
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Payments are verified securely on our
                  servers before fulfilment begins.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
