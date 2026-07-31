import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Copy, Gift, Package, ShoppingBag, Sparkles, User } from "lucide-react";

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
  const rewardProgress = Math.min(100, ((referralStatus?.successfulReferrals ?? 0) / 10) * 100);
  const rewardUnlocked = referralStatus?.rewardStatus === "unlocked";

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
            <Card className="border-border/70 bg-gradient-to-br from-primary/10 via-background to-background">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-primary">
                      <Gift className="size-3.5" /> Referral rewards
                    </div>
                    <div>
                      <h2 className="font-semibold tracking-tight">Invite friends, unlock rewards</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Each successful referral moves you closer to a reward that applies automatically at checkout.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-background/80 px-3 py-2 text-right shadow-sm">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Progress</p>
                    <p className="text-lg font-semibold">{referralStatus?.successfulReferrals ?? 0}/10</p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Your referral link</p>
                      <p className="text-xs text-muted-foreground">Share it with friends and earn progress together.</p>
                    </div>
                    <Badge variant={rewardUnlocked ? 'default' : 'secondary'} className="capitalize">
                      {rewardUnlocked ? 'Unlocked' : 'In progress'}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-3">
                    {referralLink ? (
                      <div className="rounded-xl border border-border/70 bg-background p-3 text-sm break-all">
                        <code className="block break-words">{referralLink}</code>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Generating your referral link...</p>
                    )}

                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${rewardProgress}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">{Math.round(rewardProgress)}%</span>
                    </div>

                    {referralLink ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          await navigator.clipboard.writeText(referralLink);
                        }}
                      >
                        <Copy className="mr-2 size-4" /> Copy referral link
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <CheckCircle2 className="size-4 text-primary" /> Reward status
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {rewardUnlocked
                        ? 'Your reward is ready and can be applied automatically on eligible orders.'
                        : `You’re ${referralStatus?.successfulReferrals ?? 0} of 10 referrals away from unlocking the bonus.`}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Sparkles className="size-4 text-primary" /> How it works
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Once a referral becomes successful, your progress updates instantly and the reward can be used at checkout.
                    </p>
                  </div>
                </div>

                {rewardUnlocked ? (
                  <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm text-primary">
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
