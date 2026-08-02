import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/analytics/")({
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Analytics</p>
        <h1 className="text-3xl font-bold tracking-tight">Performance overview</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Orders</p><p className="mt-2 text-2xl font-bold">Live</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Conversion</p><p className="mt-2 text-2xl font-bold">N/A</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Watchlist</p><p className="mt-2 text-2xl font-bold">Stable</p></CardContent></Card>
      </div>
    </div>
  );
}
