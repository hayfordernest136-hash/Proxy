import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PricingTemplate = {
  id: number;
  name: string;
  lines: string;
};

const initialTemplates: PricingTemplate[] = [
  {
    id: 1,
    name: "Starter",
    lines: "10ip=20\n20ip=35\n50ip=80",
  },
  {
    id: 2,
    name: "Growth",
    lines: "10ip=18\n20ip=30\n50ip=65",
  },
];

export const Route = createFileRoute("/_authenticated/admin/pricing-templates/")({
  component: AdminPricingTemplatesPage,
});

function AdminPricingTemplatesPage() {
  const [templates, setTemplates] = useState<PricingTemplate[]>(initialTemplates);
  const [name, setName] = useState("");
  const [lines, setLines] = useState("10ip=20\n20ip=35");
  const [editingId, setEditingId] = useState<number | null>(null);

  const parsedCount = useMemo(() => {
    return lines
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean).length;
  }, [lines]);

  function saveTemplate() {
    if (!name.trim()) return;

    if (editingId !== null) {
      setTemplates((current) =>
        current.map((template) =>
          template.id === editingId
            ? { ...template, name: name.trim(), lines: lines.trim() }
            : template,
        ),
      );
    } else {
      setTemplates((current) => [
        ...current,
        { id: Date.now(), name: name.trim(), lines: lines.trim() },
      ]);
    }

    setName("");
    setLines("10ip=20\n20ip=35");
    setEditingId(null);
  }

  function removeTemplate(id: number) {
    setTemplates((current) => current.filter((template) => template.id !== id));
  }

  function editTemplate(template: PricingTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setLines(template.lines);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Pricing templates</p>
        <h1 className="text-3xl font-bold tracking-tight">Template library</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label>Template name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Retail, Promo, Enterprise"
              />
            </div>
            <div className="space-y-2">
              <Label>Pricing lines</Label>
              <Textarea
                value={lines}
                onChange={(e) => setLines(e.target.value)}
                className="min-h-40"
                placeholder="10ip=20\n20ip=35"
              />
              <p className="text-xs text-muted-foreground">Detected {parsedCount} price rows.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveTemplate}>
                {editingId !== null ? "Save template" : "Create template"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setName("");
                  setLines("10ip=20\n20ip=35");
                }}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold">Saved templates</p>
            {templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.lines.split(/\r?\n/).filter(Boolean).length} price rows
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => editTemplate(template)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => removeTemplate(template.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.lines
                    .split(/\r?\n/)
                    .filter(Boolean)
                    .slice(0, 3)
                    .map((line) => (
                      <Badge key={line} variant="secondary">
                        {line}
                      </Badge>
                    ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
