import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ShoppingCart, Loader2, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { addDataCartItem, getDataCartItems, isValidGhanaPhoneNumber, saveDataCartItems } from "@/lib/data-store";
import { useSession } from "@/hooks/useSession";
import { cn } from "@/lib/utils";

const DATA_NETWORKS = ["MTN", "Telecel", "AirtelTigo"] as const;

function normalizeBundleSizeLabel(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  const compact = raw.replace(/\s+/g, "");
  const match = compact.match(/^(\d+(?:\.\d+)?)(GB|MB|TB)$/i);
  if (!match) return raw;

  const numeric = Number.parseFloat(match[1]);
  const normalizedNumber = Number.isInteger(numeric)
    ? String(numeric)
    : String(numeric).replace(/(\.\d*?[1-9])0+$/g, "$1").replace(/\.0+$/g, "");
  const suffix = match[2].toUpperCase();

  return `${normalizedNumber}${suffix}`;
}

function getBundleDisplayDetails(bundle: DataBundle) {
  const name = normalizeBundleSizeLabel(bundle.name || "");
  const volume = normalizeBundleSizeLabel(bundle.volume || "");

  if (!name && !volume) {
    return { name: "Data bundle", secondary: "" };
  }

  const primary = name || volume || "Data bundle";
  const secondary = volume && volume.toLowerCase() !== primary.toLowerCase() ? volume : "";

  return { name: primary, secondary };
}

type DataBundle = {
  id: string;
  name: string;
  volume?: string;
  price: number;
  basePrice?: number;
  currency: string;
  network: string;
  reference?: string;
  description?: string;
  markupPercent?: number;
};

type DataTrackingResult = {
  orderId: string;
  orderNumber: number;
  network: string;
  dataBundle: string;
  amount: number;
  currency: string;
  deliveryNumber: string;
  contactNumber: string;
  status: string;
  deliveryStatus: string;
  orderDate: string;
  lastUpdate: string;
};

export const Route = createFileRoute("/data/")({
  head: () => ({
    meta: [
      { title: "Data Store - BrokeFlex" },
      { name: "description", content: "Browse live data bundles from MTN, Telecel, and AirtelTigo." },
      { property: "og:title", content: "Data Store - BrokeFlex" },
      { property: "og:description", content: "Secure data bundle checkout with instant Paystack payments." },
    ],
  }),
  component: DataIndexPage,
});

function DataIndexPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [selectedNetwork, setSelectedNetwork] = useState<(typeof DATA_NETWORKS)[number]>("MTN");
  const [selectedBundle, setSelectedBundle] = useState<DataBundle | null>(null);
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const { data: bundles, isLoading, isError, error } = useQuery({
    queryKey: ["data-bundles", selectedNetwork],
    queryFn: async () => {
      const data = await apiFetch<DataBundle[]>(`/api/data/bundles?network=${encodeURIComponent(selectedNetwork)}`);
      return data;
    },
    staleTime: 60_000,
    gcTime: 120_000,
  });

  const errorMessage = error instanceof Error ? error.message : "Unable to load bundles right now.";

  const [cartCount, setCartCount] = useState(() => getDataCartItems().length);

  async function addToCart() {
    if (!selectedBundle) {
      toast.error("Choose a bundle first.");
      return;
    }
    if (!deliveryNumber || !isValidGhanaPhoneNumber(deliveryNumber)) {
      toast.error("Enter a valid Ghana mobile number to receive the data.");
      return;
    }

    setIsAddingToCart(true);
    try {
      addDataCartItem({
        id: `${selectedBundle.id}-${Date.now()}`,
        network: selectedBundle.network,
        bundle: selectedBundle.name,
        price: selectedBundle.price,
        currency: selectedBundle.currency,
        deliveryNumber,
        createdAt: Date.now(),
      });
      toast.success("Bundle added to cart.");
      setSelectedBundle(null);
      setDeliveryNumber("");
      setCartCount(getDataCartItems().length);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add bundle to cart.");
    } finally {
      setIsAddingToCart(false);
    }
  }

  async function buyNow() {
    if (!selectedBundle) {
      toast.error("Choose a bundle first.");
      return;
    }
    if (!deliveryNumber || !isValidGhanaPhoneNumber(deliveryNumber)) {
      toast.error("Enter a valid Ghana mobile number to receive the data.");
      return;
    }

    const cart = getDataCartItems();
    const item = {
      id: `${selectedBundle.id}-${Date.now()}`,
      network: selectedBundle.network,
      bundle: selectedBundle.name,
      price: selectedBundle.price,
      currency: selectedBundle.currency,
      deliveryNumber,
      createdAt: Date.now(),
    };
    const nextCart = [item, ...cart];
    saveDataCartItems(nextCart);
    navigate({ to: "/data/checkout", search: { orderId: undefined, reference: undefined } });
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Data Store</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Buy bundles instantly</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate({ to: "/data/checkout", search: { orderId: undefined, reference: undefined } })}>
              <ShoppingCart className="mr-2 size-4" /> Cart ({cartCount})
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-sm">
          <div className="flex flex-wrap gap-2 border-b border-border/70 bg-muted/30 p-3">
            {DATA_NETWORKS.map((network) => (
              <Button
                key={network}
                size="sm"
                variant={selectedNetwork === network ? "default" : "outline"}
                onClick={() => {
                  setSelectedNetwork(network);
                  setSelectedBundle(null);
                  setDeliveryNumber("");
                }}
              >
                {network}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate({
                to: "/data/track",
                search: { orderId: undefined, contactNumber: undefined },
              })}
            >
              <Search className="mr-2 size-4" />
              Track
            </Button>
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-[1.25fr_0.75fr]">
              <div>
                {isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <Skeleton key={index} className="h-36 rounded-xl" />
                    ))}
                  </div>
                ) : isError ? (
                  <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/25 text-center text-sm text-muted-foreground">
                    {errorMessage}
                  </div>
                ) : !bundles?.length ? (
                  <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/25 px-4 text-center text-sm text-muted-foreground">
                    This network is currently unavailable.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Select bundle
                      </p>
                      {selectedBundle ? (
                        <span className="text-base font-bold tracking-tight text-primary">
                          {formatMoney(selectedBundle.price, selectedBundle.currency)}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(80px,1fr))]">
                      {bundles.map((bundle) => {
                        const isSelected = selectedBundle?.id === bundle.id;
                        const { name, secondary } = getBundleDisplayDetails(bundle);
                        return (
                          <button
                            key={bundle.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => {
                              setSelectedBundle(bundle);
                            }}
                            className={cn(
                              "flex flex-col justify-center rounded-xl border px-2 py-2 text-center transition-all",
                              isSelected
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border bg-background hover:border-primary/40 hover:bg-primary/5",
                            )}
                          >
                            <span className="text-xs font-semibold">{name}</span>
                            {secondary ? (
                              <span className="mt-0.5 text-[10px] text-muted-foreground">{secondary}</span>
                            ) : null}
                            {isSelected ? (
                              <span className="mt-1 inline-flex items-center justify-center text-[10px] font-medium text-primary">
                                <CheckCircle2 className="mr-1 size-3" /> Selected
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                <div className="space-y-2">
                  <Label htmlFor="data-delivery-number">Delivery Number</Label>
                  <Input
                    id="data-delivery-number"
                    value={deliveryNumber}
                    onChange={(e) => setDeliveryNumber(e.target.value)}
                    placeholder="0240000000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ghana numbers only. We validate this before checkout.
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  <Button className="w-full" size="lg" onClick={buyNow} disabled={!selectedBundle}>
                    Buy Now
                  </Button>
                  <Button className="w-full" size="lg" variant="secondary" onClick={addToCart} disabled={!selectedBundle || isAddingToCart}>
                    {isAddingToCart ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ShoppingCart className="mr-2 size-4" />}
                    Add to Cart
                  </Button>
                </div>

                {user ? (
                  <p className="mt-4 text-xs text-muted-foreground">Logged-in customers will also see this order in order history.</p>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">No account required. Guest purchases complete using the details entered during checkout.</p>
                )}
              </div>
            </div>
        </div>
      </div>
    </SiteLayout>
  );
}

