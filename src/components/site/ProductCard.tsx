import { Link } from "@tanstack/react-router";
import { ArrowRight, Globe2, Layers } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";

export type ProductCardData = {
  slug: string;
  name: string;
  description: string;
  proxy_type: string;
  location: string;
  image_url: string | null;
  features: string[];
  pricing_unit?: "ip" | "gb";
  from_price?: number | null;
  currency?: string;
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const unitLabel = product.pricing_unit === "gb" ? "GB pricing" : "IP pricing";

  return (
    <Card className="group overflow-hidden border-border/70 bg-card/70 p-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:card-elevated">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-secondary">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={`${product.name} proxy product`}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="hero-glow flex size-full items-center justify-center">
            <span className="text-2xl font-semibold tracking-tight text-muted-foreground">
              {product.name}
            </span>
          </div>
        )}
        <Badge className="absolute left-3 top-3 border-none bg-background/85 text-foreground backdrop-blur">
          {product.proxy_type}
        </Badge>
      </div>

      <CardContent className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{product.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {product.description}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="size-3.5" /> {product.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" /> {product.features.length} features
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-1 text-[11px] font-medium text-foreground">
            {unitLabel}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-4">
          <div>
            <p className="text-xs text-muted-foreground">Starting from</p>
            <p className="text-base font-semibold">
              {product.from_price != null
                ? formatMoney(product.from_price, product.currency)
                : "Contact us"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/products/$slug" params={{ slug: product.slug }}>
                View <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
            {/* Admin edit button injected when parent passes edit link via styles (handled in ProductsPage) */}
            {/** Placeholder slot for admin edit - parent can overlay a button using absolute positioning if needed. */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
