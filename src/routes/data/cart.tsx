import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MinusCircle, ShoppingCart, ArrowRight, PencilLine } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import {
  clearDataCartItems,
  getDataCartItems,
  removeDataCartItem,
  saveDataCartItems,
  type DataCartItem,
} from "@/lib/data-store";

export const Route = createFileRoute("/data/cart")({
  head: () => ({
    meta: [
      { title: "Data Cart - BrokeFlex Data" },
      { name: "description", content: "Review and edit your data bundle cart before checkout." },
    ],
  }),
  component: DataCartPage,
});

function DataCartPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DataCartItem[]>([]);

  useEffect(() => {
    setItems(getDataCartItems());
  }, []);

  const cartTotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [items],
  );

  async function removeItem(itemId: string) {
    const next = removeDataCartItem(itemId);
    setItems(next);
  }

  function updateDeliveryNumber(itemId: string, deliveryNumber: string) {
    const next = items.map((item) => (item.id === itemId ? { ...item, deliveryNumber } : item));
    setItems(next);
    saveDataCartItems(next);
  }

  function clearCart() {
    clearDataCartItems();
    setItems([]);
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Data Store</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Your cart</h1>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/data">Continue shopping</Link>
            </Button>
            <Button onClick={clearCart} variant="outline" disabled={!items.length}>
              Clear cart
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <Card className="border-border/70">
            <CardContent className="p-10 text-center">
              <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Your cart is empty</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose a bundle from MTN, Telecel, or AirtelTigo to begin.
              </p>
              <Button asChild className="mt-6">
                <Link to="/data">Browse data bundles</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="border-border/70">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {item.network}
                        </p>
                        <h2 className="mt-1 text-lg font-semibold">{item.bundle}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatMoney(item.price, item.currency)}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                        <MinusCircle className="mr-2 size-4" /> Remove
                      </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`delivery-${item.id}`}>Delivery Number</Label>
                      <Input
                        id={`delivery-${item.id}`}
                        value={item.deliveryNumber}
                        onChange={(e) => updateDeliveryNumber(item.id, e.target.value)}
                        placeholder="0240000000"
                      />
                      <p className="text-xs text-muted-foreground">
                        <PencilLine className="mr-1 inline size-3.5" />
                        Update the phone number that should receive the voucher.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/70">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-lg font-semibold">Order Summary</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bundles</span>
                    <span>{items.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatMoney(cartTotal, "GHS")}</span>
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() =>
                    navigate({
                      to: "/data/checkout",
                      search: { orderId: undefined, reference: undefined },
                    })
                  }
                >
                  Proceed to checkout <ArrowRight className="ml-2 size-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
