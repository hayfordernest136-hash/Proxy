import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = {
  id: number;
  name: string;
  slug: string;
};

const initialCategories: Category[] = [
  { id: 1, name: "Residential", slug: "residential" },
  { id: 2, name: "Mobile", slug: "mobile" },
  { id: 3, name: "Datacenter", slug: "datacenter" },
];

export const Route = createFileRoute("/_authenticated/admin/categories/")({
  component: AdminCategoriesPage,
});

function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");

  function addCategory() {
    if (!name.trim()) return;
    setCategories((current) => [
      ...current,
      { id: Date.now(), name: name.trim(), slug: name.trim().toLowerCase().replace(/\s+/g, "-") },
    ]);
    setName("");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Categories</p>
        <h1 className="text-3xl font-bold tracking-tight">Product taxonomy</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>New category</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Residential, ISP, Mobile" />
            </div>
            <Button onClick={addCategory}>Create category</Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            {categories.map((category) => (
              <div key={category.id} className="rounded-xl border border-border/70 p-4">
                <p className="font-semibold">{category.name}</p>
                <p className="text-sm text-muted-foreground">/{category.slug}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
