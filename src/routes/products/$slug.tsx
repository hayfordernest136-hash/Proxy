import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Globe2,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { formatMoney } from "@/lib/format";
import {
  DELIVERY_DISCLAIMER,
  DELIVERY_ETA,
  type DeliveryMethod,
} from "@/lib/order-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/products/$slug")({
  head: ({ params }) => {
    const pretty = params.slug
      .split("-")
      .map((s) => s[0]?.toUpperCase() + s.slice(1))
      .join(" ");
    return {
      meta: [
        { title: `${pretty} — Buy Proxy Plans | BrokeFlex` },
        {
          name: "description",
          content: `Buy ${pretty} proxy plans with instant CD key delivery or account refill. Transparent pricing, secure checkout.`,
        },
        { property: "og:title", content: `${pretty} — Buy Proxy Plans` },
        {
          property: "og:description",
          content: `Buy ${pretty} proxy plans with instant delivery.`,
        },
      ],
    };
  },
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();

  const [planId, setPlanId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [delivery, setDelivery] = useState<DeliveryMethod>("cd_key");
  const [refillEmail, setRefillEmail] = useState("");
  const [refillPassword, setRefillPassword] = useState("");
  const [refillNotes, setRefillNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      return await apiFetch<any>(`/api/products/${slug}`);
    },
  });

  const prices = useMemo(() => (product?.prices ?? []).sort((a,b)=>a.sort_order - b.sort_order), [product]);

  useEffect(() => {
    // pick a default plan id corresponding to the first price row
    if (!planId) {
      const firstPrice = prices[0];
      if (firstPrice && product?.plans) {
        const match = (product.plans ?? []).find((pl:any)=>pl.number_of_ips === firstPrice.number_of_ips);
        if (match) setPlanId(match.id);
      }
    }
  }, [prices, product, planId]);

  const selectedPrice = prices.find((p) => String(p.id) === String(planId) || (product?.plans ?? []).some((pl:any)=>pl.id===planId && pl.number_of_ips===p.number_of_ips)) ?? prices[0] ?? null;
  const selectedPlan = (product?.plans ?? []).find((p:any) => p.id === planId) ?? null;
  const total = (selectedPrice ? Number(selectedPrice.price) : selectedPlan ? Number(selectedPlan.price) : 0) * quantity;

  async function createOrder() {
    if (!user) {
      toast.error("Please create an account or log in to continue.");
      navigate({ to: "/auth", search: { mode: "login" } });
      return;
    }
    if (!product) return;
    // find a plan id to reference for the order; prefer selectedPlan, else try to match by selectedPrice
    if (!selectedPlan && !selectedPrice) return;

    if (delivery === "account_refill" && refillEmail.trim().length < 3) {
      toast.error("Enter the email or username of the account to refill.");
      return;
    }

    setSubmitting(true);
    const planIdToUse = selectedPlan?.id ?? ((product.plans ?? []).find((pl:any)=>pl.number_of_ips === selectedPrice?.number_of_ips)?.id ?? null);
    const planNameToUse = selectedPrice ? `${selectedPrice.number_of_ips} IPs` : (selectedPlan?.name ?? '');
    const unitPriceToUse = selectedPrice ? selectedPrice.price : (selectedPlan?.price ?? 0);
    const currencyToUse = selectedPrice ? selectedPrice.currency : (selectedPlan?.currency ?? 'GHS');

    const order = await apiFetch<any>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        product_id: product.id,
        plan_id: planIdToUse,
        product_name: product.name,
        plan_name: planNameToUse,
        proxy_type: product.proxy_type,
        quantity,
        unit_price: unitPriceToUse,
        total_amount: total,
        currency: currencyToUse,
        delivery_method: delivery,
        refill_email:
          delivery === 'account_refill' ? refillEmail.trim().slice(0, 255) : null,
        refill_password:
          delivery === 'account_refill' && refillPassword ? refillPassword.slice(0, 255) : null,
        refill_notes:
          delivery === 'account_refill' ? refillNotes.trim().slice(0, 1000) || null : null,
      }),
    });
    setSubmitting(false);

    navigate({ to: '/checkout/$orderId', params: { orderId: order.id } });
  }

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-16 sm:px-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </SiteLayout>
    );
  }

  if (!product) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h1 className="text-2xl font-semibold">Product not found</h1>
          <Button asChild className="mt-6">
            <Link to="/products">Back to products</Link>
          </Button>
        </div>
      </SiteLayout>
    );
  }

  const deliveryOptions: { value: DeliveryMethod; label: string; icon: typeof KeyRound }[] = [
    ...(product.supports_cd_key
      ? [{ value: "cd_key" as const, label: "CD Key", icon: KeyRound }]
      : []),
    ...(product.supports_account_refill
      ? [{ value: "account_refill" as const, label: "Account Refill", icon: RefreshCw }]
      : []),
  ];

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <nav className="mb-8 text-sm text-muted-foreground">
          <Link to="/products" className="hover:text-foreground">
            Proxies
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left: presentation */}
          <div className="space-y-8">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-secondary">
              <div className="aspect-[16/9] w-full">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={`${product.name} proxy product`}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="hero-glow grid size-full place-items-center">
                    <span className="text-3xl font-bold tracking-tight text-muted-foreground">
                      {product.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{product.proxy_type}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Globe2 className="size-3" /> {product.location}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-4 text-muted-foreground">{product.description}</p>
            </div>

            <Card className="border-border/70">
              <CardContent className="p-6">
                <h2 className="font-semibold tracking-tight">Features</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {product.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardContent className="space-y-4 p-6">
                <h2 className="font-semibold tracking-tight">Delivery methods</h2>
                {deliveryOptions.map((o) => (
                  <div key={o.value} className="flex gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                      <o.icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{o.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {DELIVERY_ETA[o.value]}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{DELIVERY_DISCLAIMER}</p>
              </CardContent>
            </Card>
          </div>

          {/* Right: purchase panel */}
          <div className="order-first lg:order-none lg:sticky lg:top-24 lg:self-start">
            <Card className="border-border/70">
              <CardContent className="space-y-6 p-6">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Configure your order</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a plan, quantity and how you want it delivered.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>IP Pricing</Label>
                  <div className="grid gap-2">
                    {(product?.prices ?? []).map((p:any, i:number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          // set planId to matching plan if available, otherwise use index
                          const match = (product.plans ?? []).find((pl:any)=>pl.number_of_ips === p.number_of_ips);
                          if (match) setPlanId(match.id);
                          else setPlanId(String(p.id));
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                          // active if the selected plan corresponds to this price
                          ((product?.plans ?? []).some((pl:any)=>pl.id===planId && pl.number_of_ips===p.number_of_ips) || String(planId) === String(p.id))
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="text-sm font-medium">{p.number_of_ips} IPs</span>
                        <span className="text-sm font-semibold">
                          {formatMoney(p.price, p.currency)}
                        </span>
                      </button>
                    ))}
                    {(product?.prices ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No pricing available right now.</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qty">Quantity</Label>
                  <Input
                    id="qty"
                    type="number"
                    min={1}
                    max={100}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.min(100, Math.max(1, Number(e.target.value) || 1)))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Delivery method</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {deliveryOptions.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setDelivery(o.value)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-left transition-colors",
                          delivery === o.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <o.icon className="size-4" /> {o.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {DELIVERY_ETA[o.value]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {delivery === "account_refill" ? (
                  <div className="space-y-3 rounded-lg border border-border/70 bg-muted/40 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="refill-email">Account email / username</Label>
                      <Input
                        id="refill-email"
                        value={refillEmail}
                        maxLength={255}
                        onChange={(e) => setRefillEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refill-password">Password (only if required)</Label>
                      <Input
                        id="refill-password"
                        type="password"
                        maxLength={255}
                        value={refillPassword}
                        onChange={(e) => setRefillPassword(e.target.value)}
                        placeholder="Leave blank if not needed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="refill-notes">Additional notes</Label>
                      <Textarea
                        id="refill-notes"
                        maxLength={1000}
                        value={refillNotes}
                        onChange={(e) => setRefillNotes(e.target.value)}
                        placeholder="e.g. Activate on US account. Do not change password."
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Credentials are stored securely and only visible to our fulfilment
                      team.
                    </p>
                  </div>
                ) : null}

                <div className="flex items-center justify-between border-t border-border/60 pt-4">
                  <span className="text-sm text-muted-foreground">Total</span>
                  <span className="text-2xl font-bold tracking-tight">
                    {formatMoney(total, selectedPlan?.currency ?? "GHS")}
                  </span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!selectedPlan || submitting}
                  onClick={createOrder}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 size-4" />
                  )}
                  Continue to checkout
                </Button>

                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Secure checkout ·{" "}
                  <Clock className="size-3.5" /> Fast delivery
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
