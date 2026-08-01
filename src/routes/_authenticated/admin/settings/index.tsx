import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/settings/")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Settings</p>
        <h1 className="text-3xl font-bold tracking-tight">System configuration</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Website settings and site branding management.</CardContent></Card>
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Payment, notification and operational defaults.</CardContent></Card>
      </div>
    </div>
  );
}
