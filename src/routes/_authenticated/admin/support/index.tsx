import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/support/")({
  component: AdminSupportPage,
});

function AdminSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Support</p>
        <h1 className="text-3xl font-bold tracking-tight">Support queue</h1>
      </div>
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Ticket management and escalation controls can be surfaced from this page once the support
          workflow is connected.
        </CardContent>
      </Card>
    </div>
  );
}
