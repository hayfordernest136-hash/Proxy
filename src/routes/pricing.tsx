import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { DELIVERY_DISCLAIMER } from "@/lib/order-status";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Proxy Pricing — BrokeFlex" },
      {
        name: "description",
        content:
          "Transparent pricing for every proxy plan we sell, in Ghana Cedis. No hidden fees, no forced renewals.",
      },
      { property: "og:title", content: "Proxy Pricing — BrokeFlex" },
      {
        property: "og:description",
        content: "Transparent pricing for every proxy plan we sell.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["pricing"],
    queryFn: async () => {
      const products = await apiFetch<any[]>("/api/products");
      return products;
    },
  });

  return (
    <SiteLayout>
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Pricing</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every plan, every price, in one place. Prices are managed by our team and
            update instantly across the site.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-6">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))
          : data?.map((product) => {
              const plans = (product.plans ?? [])
                .filter((p) => p.is_active)
                .sort((a, b) => a.sort_order - b.sort_order);
              return (
                <Card key={product.slug} className="border-border/70">
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold tracking-tight">
                          {product.name}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {product.proxy_type} · {product.location}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/products/$slug" params={{ slug: product.slug }}>
                          Buy now
                        </Link>
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {plans.map((plan) => (
                        <div
                          key={plan.id}
                          className="rounded-lg border border-border/70 bg-muted/30 p-4"
                        >
                          <p className="text-sm text-muted-foreground">{plan.name}</p>
                          <p className="mt-1 text-xl font-bold tracking-tight">
                            {formatMoney(plan.price, plan.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

        <p className="pt-4 text-sm text-muted-foreground">{DELIVERY_DISCLAIMER}</p>
      </section>
    </SiteLayout>
  );
}
