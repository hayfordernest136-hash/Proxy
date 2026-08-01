import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { useSession } from "@/hooks/useSession";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/products/")({
  head: () => ({
    meta: [
      { title: "All Proxy Products — BrokeFlex" },
      {
        name: "description",
        content:
          "Browse every proxy we sell: rotating residential, static ISP, mobile 4G/5G, dedicated IPv4 and bandwidth plans.",
      },
      { property: "og:title", content: "All Proxy Products — BrokeFlex" },
      {
        property: "og:description",
        content: "Rotating residential, static ISP, mobile and dedicated IPv4 proxies.",
      },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("All");
  const { user } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const products = await apiFetch<any[]>("/api/products");
      return products.map((p) => {
        const prices = (p.plans ?? [])
.filter((pl: any) => pl.is_active)
          .map((pl: any) => Number(pl.price));
        return {
          ...p,
          from_price: prices.length ? Math.min(...prices) : null,
          currency: p.plans?.[0]?.currency ?? "GHS",
        };
      });
    },
  });

  const types = useMemo(
    () => ["All", ...Array.from(new Set((data ?? []).map((p) => p.proxy_type)))],
    [data],
  );

  const filtered = (data ?? []).filter(
    (p) =>
      (type === "All" || p.proxy_type === type) &&
      (p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())),
  );

  const navigate = useNavigate();

  return (
    <SiteLayout>
      <section className="hero-glow border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Proxy products</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Every provider we resell, with live pricing set by our team. Pick a plan,
            choose CD Key or Account Refill, and pay securely.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search proxies..."
              className="pl-9"
              maxLength={60}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={type === t ? "default" : "outline"}
                onClick={() => setType(t)}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-xl" />
              ))
            : filtered.map((p) => (
                <div key={p.slug} className="relative">
                  <ProductCard product={p} />
                  {/* If admin, show Edit button overlay */}
                  {user?.role === 'admin' ? (
                    <div className="absolute right-3 top-3 z-10">
                      <Button size="sm" onClick={() => navigate({ to: `/admin/products/${p.id}/edit` })}>
                        Edit Product
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">
            No proxies match your search.
          </p>
        ) : null}
      </section>
    </SiteLayout>
  );
}
