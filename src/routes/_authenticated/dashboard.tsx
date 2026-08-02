import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Copy, Eye, EyeOff, Gift, Menu, Package, ShoppingBag, Sparkles, User, Wifi } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      { title: "Your Dashboard - BrokeFlex" },
      {
        name: "description",
        content: "Track proxy orders, collect CD keys and read notifications.",
      },
      { property: "og:title", content: "Your Dashboard - BrokeFlex" },
      { property: "og:description", content: "Track your proxy orders and CD keys." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, refreshSession } = useSession();
  const queryClient = useQueryClient();
  const [referralOrigin, setReferralOrigin] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReferralOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setProfileName(user?.name ?? "");
  }, [user?.name]);

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
  const proxyOrders = (orders ?? []).filter(
    (o) => o.delivery_method !== "data_bundle",
  );
  const dataOrders = (orders ?? []).filter((o) => o.delivery_method === "data_bundle");
  const proxyActive = proxyOrders.filter(
    (o) => !["completed", "cancelled", "refunded"].includes(o.status),
  );
  const dataActive = dataOrders.filter(
    (o) => !["completed", "cancelled", "refunded"].includes(o.status),
  );
  const paidOrders = (orders ?? [])
    .filter((o) => o.payment_status === "paid")
    .reduce((sum, o) => sum + Number(o.total_amount), 0);
  const currency = orders?.[0]?.currency ?? "GHS";

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

  async function saveProfile() {
    const trimmedName = profileName.trim();
    if (!trimmedName && !currentPassword && !newPassword && !confirmPassword) {
      toast.error("No changes to save.");
      return;
    }
    if (trimmedName.length < 2) {
      toast.error("Please enter a display name.");
      return;
    }
    if ((currentPassword || newPassword || confirmPassword) && (!currentPassword || !newPassword || !confirmPassword)) {
      toast.error("Please fill in your current password, new password, and confirmation.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setSavingProfile(true);
    try {
      await apiFetch("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmedName,
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
          confirm_password: confirmPassword || undefined,
        }),
      });
      toast.success("Profile updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refreshSession();
      setProfileOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Unable to update profile.");
    } finally {
      setSavingProfile(false);
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
              Here is everything happening with your proxy and data orders.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Dashboard stats</SheetTitle>
                  <SheetDescription>
                    Quick access to your order counts and current totals.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 grid gap-3">
                  {[
                    { label: "Total orders", value: orders?.length ?? 0 },
                    { label: "Active orders", value: active.length },
                    { label: "Data orders", value: dataOrders.length },
                    { label: "Proxy orders", value: proxyOrders.length },
                    { label: "Paid value", value: formatMoney(paidOrders, currency) },
                    {
                      label: "Pending support",
                      value: orders?.filter((o) => o.support_message_unread).length ?? 0,
                    },
                  ].map((item) => (
                    <Card key={item.label} className="border-border/70">
                      <CardContent className="p-4">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="mt-1 text-xl font-semibold">{item.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <Bell className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Notifications</SheetTitle>
                  <SheetDescription>
                    All notifications for your account and orders.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-3">
                  {notifications?.length ? (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={
                          "rounded-xl border p-4 text-sm " +
                          (notification.is_read
                            ? "border-border/60"
                            : "border-primary/40 bg-primary/5")
                        }
                      >
                        <p className="font-medium">{notification.title}</p>
                        <p className="mt-1 text-muted-foreground">{notification.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No notifications yet.</p>
                  )}
                </div>
                {notifications?.some((n) => !n.is_read) ? (
                  <div className="mt-6 flex justify-end">
                    <Button size="sm" variant="secondary" onClick={markAllRead}>
                      Mark all read
                    </Button>
                  </div>
                ) : null}
              </SheetContent>
            </Sheet>

            <Button asChild>
              <Link to="/products">
                <ShoppingBag className="mr-2 size-4" /> Buy more proxies
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full">
                  <User className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{user?.name ?? "Account"}</p>
                  <p className="text-xs text-muted-foreground">{user?.email ?? "Manage your profile"}</p>
                </div>
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                  Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
                  Change password
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
          <div className="space-y-6">
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
                              Order #{o.order_number} - {o.product_name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {o.plan_name} - {DELIVERY_LABEL[o.delivery_method as DeliveryMethod]} -
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

          </div>

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
                        : `You're ${referralStatus?.successfulReferrals ?? 0} of 10 referrals away from unlocking the bonus.`}
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

          </div>
        </div>
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Account settings</DialogTitle>
              <DialogDescription>Update your display name or change your password anytime.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Display name</Label>
                <Input
                  id="profile-name"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/40 p-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Enter current password"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                      onClick={() => setShowCurrentPassword((value) => !value)}
                      aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                    >
                      {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="At least 6 characters"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                      onClick={() => setShowNewPassword((value) => !value)}
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter new password"
                      className="pr-11"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setProfileOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SiteLayout>
  );
}
