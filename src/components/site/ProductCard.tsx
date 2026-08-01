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

function renderDescriptionPreview(text: string) {
  const lines = text.split(/\r?\n/);

  return lines.map((line, lineIndex) => (
    <span key={`${line}-${lineIndex}`} className="block whitespace-pre-wrap break-words">
      {line}
      {lineIndex < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const unitLabel = product.pricing_unit === "gb" ? "GB pricing" : "IP pricing";

  return (
    <Card className="group min-w-0 overflow-hidden border-border/70 bg-card/70 p-0 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:card-elevated">
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

      <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold tracking-tight sm:text-lg">{product.name}</h3>
          <div className="mt-1 text-[11px] leading-5 text-muted-foreground sm:text-sm">
            {renderDescriptionPreview(product.description)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground sm:gap-3 sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Globe2 className="size-3.5" /> {product.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5" /> {product.features.length} features
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-1 text-[10px] font-medium text-foreground sm:text-[11px]">
            {unitLabel}
          </span>
        </div>

        <div className="flex flex-col items-stretch gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
          <div>
            <p className="text-[10px] text-muted-foreground sm:text-xs">Starting from</p>
            <p className="text-sm font-semibold sm:text-base">
              {product.from_price != null
                ? formatMoney(product.from_price, product.currency)
                : "Contact us"}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button asChild size="sm" variant="secondary" className="h-8 px-3 text-xs sm:h-9 sm:px-4 sm:text-sm">
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
