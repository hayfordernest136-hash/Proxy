import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { DELIVERY_LABEL, ORDER_STATUS_LABEL, statusTone, type DeliveryMethod, type OrderStatus } from "@/lib/order-status";

type Order = {
  id: string;
  order_number: number;
  product_name: string;
  plan_name: string;
  quantity: number;
  delivery_method: DeliveryMethod;
  status: OrderStatus;
  payment_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  refill_email: string | null;
};

const STATUS_OPTIONS: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "processing",
  "purchasing_proxy",
  "delivering",
  "completed",
  "cancelled",
  "refunded",
];

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => await apiFetch<Order[]>("/api/admin/orders"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (orders ?? []).filter((order) => {
      const statusMatches = statusFilter === "all" || order.status === statusFilter;
      const termMatches =
        !term ||
        String(order.order_number).includes(term) ||
        order.product_name.toLowerCase().includes(term) ||
        (order.refill_email ?? "").toLowerCase().includes(term);
      return statusMatches && termMatches;
    });
  }, [orders, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Orders</p>
          <h1 className="text-3xl font-bold tracking-tight">Order management</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search orders"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {ORDER_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No orders match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">#{order.order_number}</TableCell>
                      <TableCell>{order.refill_email ?? "N/A"}</TableCell>
                      <TableCell>{order.product_name}</TableCell>
                      <TableCell>{DELIVERY_LABEL[order.delivery_method]}</TableCell>
                      <TableCell>{formatMoney(order.total_amount, order.currency)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusTone(order.status)}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(order.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="secondary" asChild>
                          <Link to="/admin/orders/$orderId" params={{ orderId: order.id }}>
                            Open
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
  );
}
