import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  CreditCard,
  Loader2,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
  XCircle,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { formatMoney } from "@/lib/format";

type DataTrackingResult = {
  orderId: string;
  orderNumber: number;
  network: string;
  dataBundle: string;
  amount: number;
  currency: string;
  deliveryNumber: string;
  contactNumber: string;
  status: string;
  deliveryStatus: string;
  orderDate: string;
  lastUpdate: string;
  fulfillmentReference?: string;
  fulfillmentStatus?: string;
  fulfillmentMessage?: string;
};

type StatusTone = {
  label: string;
  badge: string;
  icon: typeof CheckCircle2;
  accent: "success" | "danger" | "warning";
};

const ACCENT_STYLES = {
  success: {
    banner:
      "border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-transparent",
    icon: "text-emerald-500",
    ring: "stroke-emerald-500",
    progress: "bg-emerald-500",
  },
  danger: {
    banner:
      "border-destructive/30 bg-gradient-to-r from-destructive/10 via-primary/10 to-transparent",
    icon: "text-destructive",
    ring: "stroke-destructive",
    progress: "bg-destructive",
  },
  warning: {
    banner: "border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent",
    icon: "text-amber-500",
    ring: "stroke-amber-500",
    progress: "bg-amber-500",
  },
} as const;

function getStatusTone(status: string): StatusTone {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("paid") ||
    normalized.includes("success") ||
    normalized.includes("delivered") ||
    normalized.includes("completed") ||
    normalized.includes("fulfilled")
  ) {
    return {
      label: "Completed",
      badge: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400",
      icon: CheckCircle2,
      accent: "success",
    };
  }
  if (
    normalized.includes("fail") ||
    normalized.includes("cancel") ||
    normalized.includes("refund") ||
    normalized.includes("error")
  ) {
    return {
      label: "Action needed",
      badge: "bg-destructive/15 text-destructive ring-destructive/30",
      icon: XCircle,
      accent: "danger",
    };
  }
  return {
    label: "In progress",
    badge: "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-400",
    icon: Loader2,
    accent: "warning",
  };
}

const DELIVERY_STEPS = [
  { label: "Order placed", icon: ReceiptText },
  { label: "Payment confirmed", icon: CreditCard },
  { label: "Processing", icon: Send },
  { label: "Delivered", icon: CheckCircle2 },
] as const;

function getDeliveryStep(deliveryStatus: string): number {
  const normalized = deliveryStatus.toLowerCase();
  if (
    normalized.includes("delivered") ||
    normalized.includes("completed") ||
    normalized.includes("fulfilled") ||
    normalized.includes("success")
  )
    return 4;
  if (
    normalized.includes("processing") ||
    normalized.includes("in progress") ||
    normalized.includes("queued") ||
    normalized.includes("active")
  )
    return 3;
  if (
    normalized.includes("paid") ||
    normalized.includes("confirmed") ||
    normalized.includes("approved")
  )
    return 2;
  return 1;
}

function formatDate(value: string | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ProgressRing({ value, className }: { value: number; className?: string }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg className="size-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className="stroke-border/70"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className={className ?? "stroke-emerald-500"}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums">{Math.round(clamped)}%</span>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof PackageCheck;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background text-primary shadow-sm ring-1 ring-border/60">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p
          className={"truncate text-sm font-semibold text-foreground " + (mono ? "font-mono" : "")}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/data/track")({
  validateSearch: (search: Record<string, unknown>) => ({
    orderId: typeof search.orderId === "string" ? search.orderId : undefined,
    contactNumber: typeof search.contactNumber === "string" ? search.contactNumber : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Track Data Order - BrokeFlex Data" },
      {
        name: "description",
        content: "Track your data order using your order ID and contact number.",
      },
    ],
  }),
  component: DataTrackPage,
});

function DataTrackPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/data/track" });
  const [orderId, setOrderId] = useState(search.orderId ?? "");
  const [contactNumber, setContactNumber] = useState(search.contactNumber ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DataTrackingResult | null>(null);

  const tone = result ? getStatusTone(result.status) : null;
  const StatusIcon = tone?.icon ?? CheckCircle2;
  const accent = tone ? ACCENT_STYLES[tone.accent] : ACCENT_STYLES.success;
  const deliveryStep = result ? getDeliveryStep(result.deliveryStatus) : 1;
  const [copied, setCopied] = useState(false);

  async function copyOrderId() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.orderId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function refreshStatus() {
    void resolveTrackingResult(orderId.trim(), contactNumber.trim());
  }

  async function resolveTrackingResult(trimmedOrderId: string, trimmedContactNumber: string) {
    if (!trimmedOrderId || !trimmedContactNumber) {
      setError("Enter both your order ID and contact number to track your order.");
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (trimmedOrderId) query.set("orderId", trimmedOrderId);
      if (trimmedContactNumber) query.set("contactNumber", trimmedContactNumber);
      const response = await apiFetch<{
        ok: boolean;
        order?: DataTrackingResult;
        message?: string;
      }>(`/api/data/track?${query.toString()}`);
      if (!response.order) {
        setResult(null);
        setError(response.message || "No matching order was found.");
        return;
      }
      setResult(response.order);
    } catch (caughtError) {
      setResult(null);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to track your order right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function trackOrder() {
    const trimmedOrderId = orderId.trim();
    const trimmedContactNumber = contactNumber.trim();

    await navigate({
      to: "/data/track",
      search: {
        orderId: trimmedOrderId || undefined,
        contactNumber: trimmedContactNumber || undefined,
      },
    });

    await resolveTrackingResult(trimmedOrderId, trimmedContactNumber);
  }

  useEffect(() => {
    if (!search.orderId && !search.contactNumber) {
      setOrderId("");
      setContactNumber("");
      setError(null);
      setResult(null);
      return;
    }

    const trimmedOrderId = (search.orderId ?? orderId).trim();
    const trimmedContactNumber = (search.contactNumber ?? contactNumber).trim();

    if (!trimmedOrderId || !trimmedContactNumber) {
      return;
    }

    void resolveTrackingResult(trimmedOrderId, trimmedContactNumber);
  }, [search.orderId, search.contactNumber]);

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">Data Store</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Track your order</h1>
          </div>
          <Button variant="secondary" onClick={() => navigate({ to: "/data" })}>
            <ArrowLeft className="mr-2 size-4" />
            Back to bundles
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-border/70 bg-card/90">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-primary" />
                <h2 className="text-lg font-semibold">Track Order</h2>
              </div>

              <div className="space-y-2">
                <Label htmlFor="track-order-id">Order ID</Label>
                <Input
                  id="track-order-id"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="BRK-100-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="track-contact-number">Contact Number</Label>
                <Input
                  id="track-contact-number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="0240000000"
                />
              </div>

              <Button className="w-full" size="lg" onClick={trackOrder} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Search className="mr-2 size-4" />
                )}
                Track
              </Button>

              {error ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5" />
                Use your order ID and contact number to instantly view the latest order status.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/90">
            <CardContent className="p-6">
              {result ? (
                // ========== REDESIGNED UI ==========
                <div className="space-y-6">
                  {/* Status Header – compact with progress bar */}
                  <div className="rounded-2xl bg-muted/30 p-5 ring-1 ring-border/70">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="rounded-full bg-background p-2.5 shadow-sm ring-1 ring-border/60">
                          <StatusIcon className={"size-6 " + accent.icon} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{result.status}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={tone!.badge + " rounded-full px-2 py-0.5"}>
                              {tone!.label}
                            </span>
                            <span>•</span>
                            <span>{result.deliveryStatus}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium tabular-nums">
                          {Math.round((deliveryStep / DELIVERY_STEPS.length) * 100)}%
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Progress
                        </p>
                      </div>
                    </div>
                    {/* Progress bar – moves based on deliveryStep */}
                    <div className="mt-3 h-1.5 w-full rounded-full bg-border">
                      <div
                        className={
                          "h-full rounded-full transition-all duration-500 ease-out " +
                          accent.progress
                        }
                        style={{ width: `${(deliveryStep / DELIVERY_STEPS.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Key Metrics – 2x2 grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Order ID
                      </p>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-mono text-sm font-bold">{result.orderId}</span>
                        <button
                          onClick={copyOrderId}
                          className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                          title="Copy"
                        >
                          {copied ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Network
                      </p>
                      <p className="mt-1 text-sm font-bold">{result.network}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Bundle
                      </p>
                      <p className="mt-1 text-sm font-bold">{result.dataBundle}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Amount
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {formatMoney(result.amount, result.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Delivery & Contact */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Smartphone className="size-3.5" />
                        <p className="text-[10px] uppercase tracking-wider">Delivery</p>
                      </div>
                      <p className="mt-1 text-sm font-bold">{result.deliveryNumber}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3.5" />
                        <p className="text-[10px] uppercase tracking-wider">Contact</p>
                      </div>
                      <p className="mt-1 text-sm font-bold">{result.contactNumber || "—"}</p>
                    </div>
                  </div>

                  {/* Rema (optional) */}
                  {(result.fulfillmentReference ||
                    result.fulfillmentStatus ||
                    result.fulfillmentMessage) && (
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Fulfilment details
                      </p>
                      <div className="mt-1 space-y-1 text-sm">
                        {result.fulfillmentReference && (
                          <p>
                            <span className="text-muted-foreground">Reference:</span>{" "}
                            {result.fulfillmentReference}
                          </p>
                        )}
                        {result.fulfillmentStatus && (
                          <p>
                            <span className="text-muted-foreground">Status:</span>{" "}
                            {result.fulfillmentStatus}
                          </p>
                        )}
                        {result.fulfillmentMessage && (
                          <p>
                            <span className="text-muted-foreground">Notes:</span>{" "}
                            {result.fulfillmentMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="flex flex-wrap justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Ordered:</span>{" "}
                      {new Date(result.orderDate).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Last update:</span>{" "}
                      {new Date(result.lastUpdate).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 text-center text-sm text-muted-foreground">
                  Enter your order ID and contact number to see your order status here.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline">
            <Link to="/data">Browse bundles</Link>
          </Button>
        </div>
      </div>
    </SiteLayout>
  );
}
