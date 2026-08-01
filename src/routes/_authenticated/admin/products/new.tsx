import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ProductEdit, { ProductDraft } from "@/components/admin/ProductEdit";

type AdminProduct = {
  id: number;
  name: string;
  prices?: any[];
};

export const Route = createFileRoute("/_authenticated/admin/products/new")({
  component: AdminNewProductPage,
});

function AdminNewProductPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => await apiFetch<AdminProduct[]>("/api/admin/products"),
  });

  const [productDraft, setProductDraft] = useState<ProductDraft>({
    name: "",
    description: "",
    proxy_type: "",
    location: "",
    duration_days: null,
    image_url: "",
    features: [],
    is_active: 1,
    supports_cd_key: 1,
    supports_account_refill: 1,
    prices: [],
    availability_status: "available",
  });

  const productMutation = useMutation({
    mutationFn: async (body: ProductDraft) =>
      await apiFetch("/api/admin/products", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
      navigate({ to: "/admin/products" });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to create product");
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {isLoading ? (
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
      ) : (
        <ProductEdit
          title="Create product"
          submitLabel="Save product"
          product={productDraft}
          products={products ?? []}
          onChange={setProductDraft}
          onCancel={() => navigate({ to: "/admin/products" })}
          onSubmit={() => productMutation.mutate(productDraft)}
          saving={productMutation.isPending}
        />
      )}
    </div>
  );
}
