import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock,
  CreditCard,
  KeyRound,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Zap,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { DELIVERY_DISCLAIMER } from "@/lib/order-status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BrokeFlex - Buy Data Bundles & Proxies Instantly" },
      {
        name: "description",
        content:
          "Affordable mobile data bundles and reliable proxy solutions in one place. Instant delivery, secure Paystack checkout and human support.",
      },
      { property: "og:title", content: "BrokeFlex - Data Bundles & Proxies" },
      {
        property: "og:description",
        content:
          "Buy mobile data instantly or get reliable proxies for your online needs - all in one place.",
      },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  {
    icon: Zap,
    title: "Instant delivery",
    body: "Data bundles land on your phone in minutes, and proxy orders are fulfilled fast so you're never left waiting.",
  },
  {
    icon: Wallet,
    title: "Affordable prices",
    body: "Cheap data bundles across MTN, Telecel and AirtelTigo, plus fairly priced proxies for every budget.",
  },
  {
    icon: ShieldCheck,
    title: "Secure payments",
    body: "Encrypted Paystack checkout with multiple local payment options keeps every transaction safe.",
  },
  {
    icon: MessagesSquare,
    title: "24/7 WhatsApp support",
    body: "Real humans ready to help with data orders, proxy setup, failed payments and account issues.",
  },
];

function HomePage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["home-products"],
    queryFn: async () => {
      const data = await apiFetch<any[]>("/api/products?limit=6");
      return data.map((p) => {
        const prices = (p.prices ?? []).map((pr:any)=>Number(pr.price));
        return {
          ...p,
          from_price: prices.length ? Math.min(...prices) : null,
          currency: p.prices?.[0]?.currency ?? "GHS",
        };
      });
    },
  });

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:py-32">
          <div className="max-w-3xl">
            <Badge variant="secondary" className="mb-6 gap-2 rounded-full px-3 py-1">
              <span className="size-1.5 rounded-full bg-success" />
              Instant delivery - Paystack supported
            </Badge>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              Affordable data bundles and{" "}
              <span className="gradient-text">reliable proxy solutions</span> in one
              place.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Buy mobile data instantly for your phone, or get reliable proxies for your
              online needs - all from one platform you can trust. Pay securely with
              Paystack and get delivered fast.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/data">
                  Buy data bundles <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/products">Browse proxies</Link>
              </Button>
            </div>

            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                ["190+", "Countries"],
                ["100%", "Secure payments"],
                ["Instant", "Data delivery"],
                ["24/7", "WhatsApp support"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-bold tracking-tight">{value}</dt>
                  <dd className="text-sm text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border/70 bg-card/60">
              <CardContent className="space-y-3 p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="font-semibold tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Popular plans</h2>
              <p className="mt-2 text-muted-foreground">
                Hand-picked proxy plans and data bundles, transparent pricing, no hidden
                renewals.
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link to="/products">
                View all <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 rounded-xl" />
                ))
              : products?.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight">Everything you need in one place</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Buy mobile data for yourself or as a gift, or pick a proxy plan for your
          online work. Every order is handled by our team the moment your payment lands.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card className="border-border/70">
            <CardContent className="space-y-3 p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <Zap className="size-5" />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">Mobile Data</h3>
              <p className="text-sm text-muted-foreground">
                Cheap data bundles for MTN, Telecel and AirtelTigo numbers - delivered
                straight to your phone in minutes.
              </p>
              <Button asChild size="sm" className="mt-2">
                <Link to="/data">Buy data</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-3 p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <KeyRound className="size-5" />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">Proxy CD Key</h3>
              <p className="text-sm text-muted-foreground">
                Get a proxy activation key in your dashboard, ready to redeem on the
                provider's platform.
              </p>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Clock className="size-4" /> Usually within 2 minutes after payment
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="space-y-3 p-7">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <RefreshCw className="size-5" />
              </span>
              <h3 className="text-xl font-semibold tracking-tight">Proxy Account Refill</h3>
              <p className="text-sm text-muted-foreground">
                Give us your provider username and any notes - we top up or activate your
                existing account for you.
              </p>
              <p className="inline-flex items-center gap-2 text-sm font-medium text-primary">
                <Clock className="size-4" /> Usually within 5-7 minutes after payment
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">{DELIVERY_DISCLAIMER}</p>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-20 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Ready to get started?</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Create a free account, grab a data bundle or pick a proxy plan, and pay
              securely with Paystack. Our team handles the rest.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "register" }}>
                <CreditCard className="mr-2 size-4" /> Create account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/support">
                <MessagesSquare className="mr-2 size-4" /> Talk to support
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
