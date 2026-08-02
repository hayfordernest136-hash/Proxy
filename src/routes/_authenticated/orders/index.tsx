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
      { title: "Order History - BrokeFlex" },
      { name: "description", content: "Every proxy order you have placed and its status." },
      { property: "og:title", content: "Order History - BrokeFlex" },
      { property: "og:description", content: "Every proxy order you have placed." },
    ],
  }),
  component: OrdersPage,
});

const STATUS_FILTERS = ["All", "Active", "Completed", "Cancelled"] as const;
const TYPE_FILTERS = ["All", "Proxy", "Data"] as const;

function OrdersPage() {
  const { user } = useSession();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("All");
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return await apiFetch<any[]>("/api/orders");
    },
  });

  const orders = data ?? [];
  const filteredOrders = orders.filter((o) => {
    const matchesStatus =
      statusFilter === "All" ||
      (statusFilter === "Completed" && o.status === "completed") ||
      (statusFilter === "Cancelled" && ["cancelled", "refunded"].includes(o.status)) ||
      (statusFilter === "Active" && !["completed", "cancelled", "refunded"].includes(o.status));

    const matchesType =
      typeFilter === "All" ||
      (typeFilter === "Proxy" && o.delivery_method !== "data_bundle") ||
      (typeFilter === "Data" && o.delivery_method === "data_bundle");

    return matchesStatus && matchesType;
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
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={statusFilter === f ? "default" : "outline"}
                  onClick={() => setStatusFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={typeFilter === f ? "default" : "outline"}
                  onClick={() => setTypeFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
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
              <p className="py-16 text-center text-sm text-muted-foreground">No orders here yet.</p>
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
                    {filteredOrders.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">#{o.order_number}</TableCell>
                        <TableCell>{o.product_name}</TableCell>
                        <TableCell>{o.plan_name}</TableCell>
                        <TableCell>{o.quantity}</TableCell>
                        <TableCell>{DELIVERY_LABEL[o.delivery_method as DeliveryMethod]}</TableCell>
                        <TableCell>{formatMoney(o.total_amount, o.currency)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusTone(o.status as OrderStatus)}>
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
