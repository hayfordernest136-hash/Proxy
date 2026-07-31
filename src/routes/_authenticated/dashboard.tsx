import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Copy, Package, ShoppingBag, User } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiFetch } from "@/lib/api";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  statusTone,
  type DeliveryMethod,
  type OrderStatus,
} from "@/lib/order-status";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your Dashboard — BrokeFlex" },
      {
        name: "description",
        content: "Track proxy orders, collect CD keys and read notifications.",
      },
      { property: "og:title", content: "Your Dashboard — BrokeFlex" },
      { property: "og:description", content: "Track your proxy orders and CD keys." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [referralOrigin, setReferralOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReferralOrigin(window.location.origin);
    }
  }, []);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return await apiFetch<any[]>("/api/orders");
    },
  });
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [highlightedOrder, setHighlightedOrder] = useState<any>(null);

  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return await apiFetch<any[]>("/api/notifications");
    },
  });

  const { data: referralStatus } = useQuery({
    queryKey: ["referral-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      return await apiFetch<any>("/api/referrals/status");
    },
  });

  const referralLink = referralOrigin && referralStatus?.referralCode
    ? `${referralOrigin}/auth?referral_code=${referralStatus.referralCode}`
    : null;

  const active = (orders ?? []).filter(
    (o) => !["completed", "cancelled", "refunded"].includes(o.status),
  );
  const spent = (orders ?? [])
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  const markReadMutation = useMutation({
    mutationFn: async () => {
      return await apiFetch<{ ok: boolean }>("/api/notifications/mark-read", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  async function markAllRead() {
    await markReadMutation.mutateAsync();
  }

  useEffect(() => {
    if (!orders?.length) return;
    const unreadOrder = orders.find(
      (o) =>
        (o.status === "cancelled" || o.status === "refunded") &&
        o.support_message_unread,
    );
    if (unreadOrder) {
      setHighlightedOrder(unreadOrder);
      setSupportDialogOpen(true);
    }
  }, [orders]);

  async function markSupportMessageRead() {
    if (!highlightedOrder) return;
    try {
      await apiFetch(`/api/orders/${highlightedOrder.id}/support-message/read`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["my-orders", user?.id] });
    } catch (error) {
      console.error('Unable to mark support message read:', error);
    }
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
            </h1>
            <p className="mt-1 text-muted-foreground">
              Here is everything happening with your proxies.
            </p>
          </div>
          <Button asChild>
            <Link to="/products">
              <ShoppingBag className="mr-2 size-4" /> Buy more proxies
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total orders", value: orders?.length ?? 0, icon: Package },
            { label: "Active orders", value: active.length, icon: Bell },
            {
              label: "Total spent",
              value: formatMoney(spent),
              icon: User,
            },
          ].map((s) => (
            <Card key={s.label} className="border-border/70">
              <CardContent className="flex items-center gap-4 p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
                  <s.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold tracking-tight">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <AlertDialog open={supportDialogOpen} onOpenChange={async (open) => {
          if (!open) {
            await markSupportMessageRead();
          }
          setSupportDialogOpen(open);
        }}>
          <AlertDialogContent className="max-w-3xl rounded-[2rem] p-10 text-center sm:p-12">
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                  Order #{highlightedOrder?.order_number}
                </p>
                <AlertDialogTitle className="text-3xl font-extrabold">
                  {highlightedOrder?.status === "cancelled"
                    ? "Order Cancelled"
                    : "Refund Issued"}
                </AlertDialogTitle>
                <AlertDialogDescription className="mx-auto max-w-2xl text-lg font-semibold leading-8 text-foreground">
                  {highlightedOrder?.admin_notes ||
                    (highlightedOrder?.status === "cancelled"
                      ? "This order was cancelled."
                      : "This order was refunded.")}
                </AlertDialogDescription>
              </div>
              <AlertDialogAction asChild>
                <Button size="lg" className="w-full">
                  Close
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card className="border-border/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold tracking-tight">Recent orders</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/orders">View all</Link>
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-lg" />
                  ))
                ) : orders?.length ? (
                  orders.slice(0, 5).map((o) => (
                    <Link
                      key={o.id}
                      to="/orders/$orderId"
                      params={{ orderId: o.id }}
                      className="block rounded-lg border border-border/70 p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            Order #{o.order_number} · {o.product_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {o.plan_name} · {DELIVERY_LABEL[o.delivery_method as DeliveryMethod]} ·{" "}
                            {formatDate(o.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            variant="outline"
                            className={statusTone(o.status as OrderStatus)}
                          >
                            {ORDER_STATUS_LABEL[o.status as OrderStatus]}
                          </Badge>
                          <p className="mt-1 text-sm font-semibold">
                            {formatMoney(o.total_amount, o.currency)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No orders yet. <Link to="/products" className="text-primary">Browse proxies</Link>.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/70">
              <CardContent className="p-6">
                <h2 className="font-semibold tracking-tight">Referral rewards</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Your referral link</dt>
                    <dd className="space-y-2">
                      {referralLink ? (
                        <div className="rounded-lg border border-border/70 bg-background p-3 text-sm break-all">
                          <code className="block break-words">{referralLink}</code>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Generating your referral link...</p>
                      )}
                      {referralLink ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-2"
                          onClick={async () => {
                            await navigator.clipboard.writeText(referralLink);
                          }}
                        >
                          <Copy className="mr-2 size-4" /> Copy referral link
                        </Button>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Successful referrals</dt>
                    <dd>{referralStatus?.successfulReferrals ?? 0}/10</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reward status</dt>
                    <dd className="capitalize">{referralStatus?.rewardStatus ?? 'locked'}</dd>
                  </div>
                </dl>
                {referralStatus?.rewardStatus === 'unlocked' ? (
                  <div className="mt-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 text-sm text-primary">
                    Your referral reward is unlocked. Apply it automatically on any eligible 10 IP proxy order at checkout.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardContent className="p-6">
                <h2 className="font-semibold tracking-tight">Profile</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd>{user?.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="break-all">{user?.email}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Member since</dt>
                    <dd>{formatDate(user?.created_at)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold tracking-tight">Notifications</h2>
                  {notifications?.some((n) => !n.is_read) ? (
                    <Button variant="ghost" size="sm" onClick={markAllRead}>
                      Mark all read
                    </Button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {notifications?.length ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={
                          "rounded-lg border p-3 text-sm " +
                          (n.is_read ? "border-border/60" : "border-primary/40 bg-primary/5")
                        }
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="text-muted-foreground">{n.body}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(n.created_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing yet.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
