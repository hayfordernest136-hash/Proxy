import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  proxy_type: string;
  location: string;
  pricing_unit?: "ip" | "gb";
  is_active: number;
  prices?: Array<{
    id: number;
    number_of_ips: number;
    price: number;
    currency: string;
    sort_order?: number;
  }>;
};

export const Route = createFileRoute("/_authenticated/admin/products/")({
  component: ProductsAdminPage,
});

function ProductsAdminPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [unitFilter, setUnitFilter] = useState<"all" | "ip" | "gb">("all");
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => await apiFetch<AdminProduct[]>("/api/admin/products"),
  });

  const productMutation = useMutation({
    mutationFn: async (input: {
      action: "toggleActive" | "delete";
      id: number;
      isActive?: number;
    }) => {
      if (input.action === "toggleActive") {
        return await apiFetch(`/api/admin/products/${input.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: input.isActive }),
        });
      }
      if (input.action === "delete") {
        return await apiFetch(`/api/admin/products/${input.id}`, {
          method: "DELETE",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product list refreshed");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Product action failed");
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products ?? []).filter((product) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && product.is_active === 1) ||
        (statusFilter === "inactive" && product.is_active === 0);
      const matchesUnit = unitFilter === "all" || (product.pricing_unit ?? "ip") === unitFilter;
      const matchesTerm =
        !term ||
        product.name.toLowerCase().includes(term) ||
        product.proxy_type.toLowerCase().includes(term) ||
        product.location.toLowerCase().includes(term);
      return matchesStatus && matchesUnit && matchesTerm;
    });
  }, [products, search, statusFilter, unitFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Product management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage products, pricing tiers, and availability from a dedicated admin screen.
          </p>
        </div>
        <Link to="/admin/products/new">
          <Button size="sm">Create product</Button>
        </Link>
      </div>

      <Card className="border-border/70">
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <div className="flex items-center gap-3">
              <Search className="size-4 text-muted-foreground" />
              <Input
                className="min-w-0"
                placeholder="Search products"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm">Status filter</Label>
              <select
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as any)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm">Pricing unit</Label>
              <select
                className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground"
                value={unitFilter}
                onChange={(event) => setUnitFilter(event.target.value as any)}
              >
                <option value="all">All units</option>
                <option value="ip">IP</option>
                <option value="gb">GB</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : !filtered.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No products found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type / Location</TableHead>
                    <TableHead>Pricing / Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => {
                    const unitLabel = product.pricing_unit === "gb" ? "GB" : "IP";
                    const priceLabel =
                      product.prices && product.prices.length
                        ? `${formatMoney(Math.min(...product.prices.map((row) => row.price)))} - ${formatMoney(
                            Math.max(...product.prices.map((row) => row.price)),
                          )}`
                        : "No pricing";

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <div>{product.proxy_type}</div>
                          <div className="text-sm text-muted-foreground">{product.location}</div>
                        </TableCell>
                        <TableCell>
                          <div>{priceLabel}</div>
                          <div className="text-sm text-muted-foreground">{unitLabel} pricing</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              product.is_active
                                ? "border-foreground text-foreground"
                                : "border-muted text-muted-foreground"
                            }
                          >
                            {product.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Switch
                              checked={!!product.is_active}
                              onCheckedChange={(checked) =>
                                productMutation.mutate({
                                  action: "toggleActive",
                                  id: product.id,
                                  isActive: checked ? 1 : 0,
                                })
                              }
                            />
                            <Link
                              to="/admin/products/$productId/edit"
                              params={{ productId: String(product.id) }}
                            >
                              <Button size="sm" variant="outline">
                                Edit
                              </Button>
                            </Link>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                productMutation.mutate({
                                  action: "delete",
                                  id: product.id,
                                })
                              }
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
