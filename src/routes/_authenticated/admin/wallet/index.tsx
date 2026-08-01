import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/wallet/")({
  component: AdminWalletPage,
});

function AdminWalletPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Wallet</p>
        <h1 className="text-3xl font-bold tracking-tight">Wallet balance</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Available balance</p><p className="mt-2 text-2xl font-bold">$0.00</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Recent payouts</p><p className="mt-2 text-2xl font-bold">0</p></CardContent></Card>
      </div>
    </div>
  );
}
