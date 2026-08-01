import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PricingEditor from "@/components/admin/PricingEditor";

export type ProductDraft = {
  id?: number;
  slug?: string;
  name: string;
  description: string;
  proxy_type: string;
  location: string;
  duration_days: number | null;
  image_url: string;
  features: string[];
  is_active: number;
  supports_cd_key: number;
  supports_account_refill: number;
  prices: any[];
  availability_status: string;
};

type ProductEditProps = {
  title: string;
  submitLabel: string;
  product: ProductDraft;
  products?: Array<{ id: number; name: string; prices?: any[] }>;
  onChange: (next: ProductDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving?: boolean;
};

function normalizePrices(source: any[]) {
  return (source ?? []).map((row: any, index: number) => ({
    id: row.id ?? `row-${index}`,
    number_of_ips: Number(row.number_of_ips ?? row.quantity ?? 0),
    price: Number(row.price ?? 0),
    currency: row.currency ?? "GHS",
    sort_order: Number(row.sort_order ?? index),
  }));
}

export default function ProductEdit({
  title,
  submitLabel,
  product,
  products,
  onChange,
  onSubmit,
  onCancel,
  saving,
}: ProductEditProps) {
  const values = useMemo(() => product, [product]);

  const copySources = (products ?? []).filter((p) => p.id !== values.id);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-background p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage product details and pricing in one dedicated screen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={values.name}
                  onChange={(e) => onChange({ ...values, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Proxy type</Label>
                <Input
                  value={values.proxy_type}
                  onChange={(e) => onChange({ ...values, proxy_type: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={values.location}
                  onChange={(e) => onChange({ ...values, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input
                  value={values.image_url}
                  onChange={(e) => onChange({ ...values, image_url: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>Description</Label>
              <Textarea
                value={values.description}
                onChange={(e) => onChange({ ...values, description: e.target.value })}
                className="min-h-[150px]"
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Features</Label>
                <Textarea
                  value={values.features.join(", ")}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      features: e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="comma-separated features"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  value={values.duration_days ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      duration_days: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Pricing</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add product pricing tiers and import/export pricing data.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:items-end">
                <div className="space-y-2">
                  <Label>Copy pricing from product</Label>
                  <Select
                    value=""
                    onValueChange={(value) => {
                      const source = copySources.find(
                        (item) => String(item.id) === value,
                      );
                      if (source) {
                        onChange({
                          ...values,
                          prices: normalizePrices(source.prices ?? []),
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {copySources.map((source) => (
                        <SelectItem key={source.id} value={String(source.id)}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Clear pricing</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ ...values, prices: [] })}
                  >
                    Clear pricing
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <PricingEditor
                initial={values.prices}
                onChange={(next) => onChange({ ...values, prices: next })}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-border/70 bg-background p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Visibility
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Control product state and delivery options.
              </p>
            </div>
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-sm text-muted-foreground">Show product in listings.</p>
                </div>
                <Switch
                  checked={!!values.is_active}
                  onCheckedChange={(checked) =>
                    onChange({ ...values, is_active: checked ? 1 : 0 })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">CD Key support</p>
                  <p className="text-sm text-muted-foreground">Allow instant CD key delivery.</p>
                </div>
                <Switch
                  checked={!!values.supports_cd_key}
                  onCheckedChange={(checked) =>
                    onChange({ ...values, supports_cd_key: checked ? 1 : 0 })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/60 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Account refill</p>
                  <p className="text-sm text-muted-foreground">Enable refill delivery if supported.</p>
                </div>
                <Switch
                  checked={!!values.supports_account_refill}
                  onCheckedChange={(checked) =>
                    onChange({ ...values, supports_account_refill: checked ? 1 : 0 })
                  }
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
