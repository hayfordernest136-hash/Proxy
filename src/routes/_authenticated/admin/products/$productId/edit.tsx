import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductEdit, { ProductDraft } from "@/components/admin/ProductEdit";

type AdminProduct = {
  id: number;
  slug: string;
  name: string;
  description?: string;
  proxy_type?: string;
  location?: string;
  duration_days?: number | null;
  image_url?: string;
  features?: string[] | string;
  pricing_unit?: "ip" | "gb";
  is_active?: number;
  supports_cd_key?: number;
  supports_account_refill?: number;
  availability_status?: string;
  prices?: any[];
};

export const Route = createFileRoute("/_authenticated/admin/products/$productId/edit")({
  component: AdminEditProductPage,
});

function normalizeProduct(product: AdminProduct): ProductDraft {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name ?? "",
    description: product.description ?? "",
    proxy_type: product.proxy_type ?? "",
    location: product.location ?? "",
    duration_days: product.duration_days ?? null,
    image_url: product.image_url ?? "",
    features: Array.isArray(product.features)
      ? product.features
      : product.features
      ? JSON.parse(String(product.features))
      : [],
    is_active: product.is_active ? 1 : 0,
    supports_cd_key: product.supports_cd_key ? 1 : 0,
    supports_account_refill: product.supports_account_refill ? 1 : 0,
    availability_status: product.availability_status ?? "available",
    pricing_unit: product.pricing_unit === "gb" ? "gb" : "ip",
    prices: (product.prices ?? []).map((row: any, index: number) => ({
      id: row.id ?? `row-${index}`,
      number_of_ips: Number(row.number_of_ips ?? row.quantity ?? 0),
      price: Number(row.price ?? 0),
      currency: row.currency ?? "GHS",
      sort_order: Number(row.sort_order ?? index),
    })),
  };
}

function AdminEditProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = Route.useParams();
  const productId = Number(params.productId);

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => await apiFetch<AdminProduct[]>("/api/admin/products"),
  });

  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);

  useEffect(() => {
    if (!isLoading && products) {
      const product = products.find((item) => item.id === productId);
      if (product) {
        setProductDraft(normalizeProduct(product));
      }
    }
  }, [isLoading, products, productId]);

  const productMutation = useMutation({
    mutationFn: async (input: { id: number; body: ProductDraft }) =>
      await apiFetch(`/api/admin/products/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify(input.body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
      navigate({ to: "/admin/products" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to save product");
    },
  });

  if (isLoading || !productDraft) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Card className="border-border/70">
          <CardContent className="p-6">
            <Skeleton className="h-8 w-64 rounded-md" />
            <div className="mt-6 space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <ProductEdit
        title={`Edit ${productDraft.name}`}
        submitLabel="Save product"
        product={productDraft}
        products={products ?? []}
        onChange={(next) => setProductDraft(next)}
        onCancel={() => navigate({ to: "/admin/products" })}
        onSubmit={() => {
          productMutation.mutate({ id: productId, body: productDraft });
        }}
        saving={productMutation.isPending}
      />
    </div>
  );
}
