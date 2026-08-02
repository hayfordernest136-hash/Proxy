import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/transactions/")({
  component: AdminTransactionsPage,
});

function AdminTransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Transactions</p>
        <h1 className="text-3xl font-bold tracking-tight">Ledger overview</h1>
      </div>
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Transaction history is ready for connection to the finance backend when that endpoint is
          exposed.
        </CardContent>
      </Card>
    </div>
  );
}
