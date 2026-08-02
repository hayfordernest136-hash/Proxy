import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/payments/")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Payments</p>
        <h1 className="text-3xl font-bold tracking-tight">Payment operations</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Settlement status</p>
            <p className="mt-2 text-2xl font-bold">Healthy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Payment providers</p>
            <p className="mt-2 text-2xl font-bold">Paystack</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Pending payouts</p>
            <p className="mt-2 text-2xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
