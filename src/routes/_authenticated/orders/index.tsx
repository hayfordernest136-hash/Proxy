import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  statusTone,
  type DeliveryMethod,
  type OrderStatus,
} from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "Order History — Brokeflex Data" },
      { name: "description", content: "Every proxy order you have placed and its status." },
      { property: "og:title", content: "Order History — Brokeflex Data" },
      { property: "og:description", content: "Every proxy order you have placed." },
    ],
  }),
  component: OrdersPage,
});

const FILTERS = ["All", "Active", "Completed", "Cancelled"] as const;

function OrdersPage() {
  const { user } = useSession();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return await apiFetch<any[]>("/api/orders");
    },
  });

  const orders = (data ?? []).filter((o) => {
    if (filter === "All") return true;
    if (filter === "Completed") return o.status === "completed";
    if (filter === "Cancelled") return ["cancelled", "refunded"].includes(o.status);
    return !["completed", "cancelled", "refunded"].includes(o.status);
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your orders</h1>
            <p className="mt-1 text-muted-foreground">
              Track every purchase and pick up your keys.
            </p>
          </div>
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-2 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                No orders here yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Placed</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">#{o.order_number}</TableCell>
                        <TableCell>{o.product_name}</TableCell>
                        <TableCell>{o.plan_name}</TableCell>
                        <TableCell>{o.quantity}</TableCell>
                        <TableCell>
                          {DELIVERY_LABEL[o.delivery_method as DeliveryMethod]}
                        </TableCell>
                        <TableCell>{formatMoney(o.total_amount, o.currency)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={statusTone(o.status as OrderStatus)}
                          >
                            {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(o.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/orders/$orderId" params={{ orderId: o.id }}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </SiteLayout>
  );
}
