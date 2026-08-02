import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/wallet/")({
  component: AdminWalletPage,
});

function formatWalletBalance(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Unavailable";
  }

  if (typeof value === "number") {
    return formatMoney(value, "GHS");
  }

  const numericValue = Number(String(value).replace(/[^0-9.-]+/g, ""));
  if (Number.isFinite(numericValue)) {
    return formatMoney(numericValue, "GHS");
  }

  return String(value);
}

function AdminWalletPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-rema-wallet-balance"],
    queryFn: async () =>
      await apiFetch<{ balance: string | number | null }>("/api/admin/rema/wallet-balance"),
    retry: false,
  });
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setLastUpdated(new Date().toLocaleString());
    }
  }, [data]);

  const balance = formatWalletBalance(data?.balance);
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : "Unknown error"
    : undefined;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Wallet</p>
        <h1 className="text-3xl font-bold tracking-tight">Wallet balance</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Available balance</p>
                <p className="mt-2 text-2xl font-bold">
                  {isLoading ? "Loading…" : isError ? "Unable to load balance" : balance}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => void refetch()}
              >
                Refresh
              </button>
            </div>
            {isError ? (
              <p className="mt-3 text-sm text-warning">
                Could not fetch the wallet balance from Rema Data API.
                {errorMessage ? ` ${errorMessage}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Last updated</p>
            <p className="mt-2 text-2xl font-bold">{lastUpdated ?? "Not yet fetched"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
