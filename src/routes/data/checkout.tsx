import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/hooks/useSession";
import {
  clearDataCartItems,
  getDataCartItems,
  isValidGhanaPhoneNumber,
  type DataCartItem,
} from "@/lib/data-store";

export const Route = createFileRoute("/data/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
    reference: typeof search.reference === "string" ? search.reference : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Data Checkout - BrokeFlex Data" },
      { name: "description", content: "Guest-friendly checkout for data bundle purchases." },
    ],
  }),
  component: DataCheckoutPage,
});

function DataCheckoutPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/data/checkout" });
  const { user } = useSession();
  const [items, setItems] = useState<DataCartItem[]>([]);
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [contactNumber, setContactNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [redirectReference, setRedirectReference] = useState<string>("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getDataCartItems();
    setItems(stored);
  }, []);

  useEffect(() => {
    const parsedOrderId = Number(search.orderId ?? "");
    if (parsedOrderId && parsedOrderId !== orderId) {
      setOrderId(parsedOrderId);
    }
    if (typeof search.reference === "string") {
      setRedirectReference(search.reference);
    }
  }, [search.orderId, search.reference, orderId]);

  useEffect(() => {
    if (user) {
      setFullName(user.name ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [items],
  );
  const paystackTotal = total;

  function formatOrderReference(orderNumber: number) {
    const digits = String(orderNumber).padStart(6, "0");
    return `BRK-${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  async function startOrder() {
    if (!items.length) {
      toast.error("Your cart is empty.");
      return;
    }

    if (!email.trim()) {
      toast.error("Email address is required.");
      return;
    }

    if (!contactNumber.trim() || !isValidGhanaPhoneNumber(contactNumber)) {
      toast.error("Enter a valid Ghana phone number for contact.");
      return;
    }

    const invalidDelivery = items.find((item) => !isValidGhanaPhoneNumber(item.deliveryNumber));
    if (invalidDelivery) {
      toast.error("Enter valid Ghana delivery numbers for each selected bundle.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiFetch<any>("/api/data/orders", {
        method: "POST",
        body: JSON.stringify({
          items,
          customer: {
            full_name: fullName.trim(),
            email: email.trim(),
            contact_number: contactNumber.trim(),
          },
        }),
      });

      setOrderId(created.id);
      const payment = await apiFetch<{
        ok: boolean;
        authorizationUrl?: string;
        reference?: string;
        sandbox?: boolean;
      }>("/api/payments/initiate", {
        method: "POST",
        body: JSON.stringify({ orderId: created.id }),
      });

      if (payment.sandbox) {
        toast.success("Sandbox payment initiated. Your data order is now queued.");
        clearDataCartItems();
        navigate({
          to: "/payment/success/$orderId",
          params: { orderId: created.id },
          search: { reference: payment.reference },
        });
        return;
      }

      if (!payment.authorizationUrl) {
        throw new Error("Unable to start payment flow.");
      }

      clearDataCartItems();
      window.location.href = payment.authorizationUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete checkout.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!orderId || !redirectReference) return;
    if (confirming) return;

    async function confirmRedirectedPayment() {
      setConfirming(true);
      setConfirmError(null);
      try {
        const paymentResponse = await apiFetch<{ ok: boolean }>("/api/payments/confirm", {
          method: "POST",
          body: JSON.stringify({ orderId, reference: redirectReference }),
        });

        if (!paymentResponse.ok) {
          throw new Error("Unable to confirm payment.");
        }

        navigate({
          to: "/payment/success/$orderId",
          params: { orderId: String(orderId) },
          search: { reference: redirectReference || undefined },
        });
      } catch (error) {
        setConfirmError(error instanceof Error ? error.message : "Unable to confirm payment.");
      } finally {
        setConfirming(false);
      }
    }

    confirmRedirectedPayment();
  }, [orderId, redirectReference, confirming, navigate]);

  if (!items.length && !orderId) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">Your cart is empty</h1>
          <Button asChild className="mt-6">
            <Link to="/data">Browse data bundles</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  if (!items.length && orderId) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">Confirming your payment</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Please wait while we confirm your payment and finalize your data order.
          </p>
          {confirmError ? (
            <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {confirmError}
            </div>
          ) : null}
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">Data Store</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Checkout</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card className="border-border/70">
            <CardContent className="space-y-5 p-6">
              <div>
                <h2 className="text-lg font-semibold">Order summary</h2>
                <div className="mt-3 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <div>
                          <p className="font-medium">{item.network}</p>
                          <p className="text-muted-foreground">{item.bundle}</p>
                          <p className="text-muted-foreground">
                            Delivery Number: {item.deliveryNumber}
                          </p>
                        </div>
                        <div className="font-semibold">
                          {formatMoney(item.price, item.currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full Name (Optional)</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-address">Email Address (Required)</Label>
                  <Input
                    id="email-address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="contact-number">Contact Number (Required)</Label>
                  <Input
                    id="contact-number"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="0240000000"
                  />
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={startOrder} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 size-4" />
                )}
                Proceed to Checkout
              </Button>
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" /> Secure Paystack checkout with instant data
                fulfilment.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-lg font-semibold">Payment summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Bundle total</span>
                  <span>{formatMoney(total, "GHS")}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/70 pt-3 font-semibold">
                  <span>Total</span>
                  <span>{formatMoney(paystackTotal, "GHS")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteLayout>
  );
}
