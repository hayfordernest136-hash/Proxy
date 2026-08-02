import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/notifications/")({
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Notifications</p>
        <h1 className="text-3xl font-bold tracking-tight">Broadcast center</h1>
      </div>
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Notification templates and delivery logs can be managed here once the messaging endpoint
          is exposed.
        </CardContent>
      </Card>
    </div>
  );
}
