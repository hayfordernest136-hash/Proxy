import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  statusTone,
  type DeliveryMethod,
  type OrderStatus,
} from "@/lib/order-status";

type AdminTrendPoint = {
  date: string;
  revenue: number;
  orders: number;
};

type AdminStatusSnapshot = {
  status: string;
  count: number;
};

type AdminSeriesItem = {
  label: string;
  value: number;
};

type AdminTopProduct = {
  product: string;
  orders: number;
  revenue: number;
};

type AdminTopBundle = {
  bundle: string;
  orders: number;
  revenue: number;
};

type AdminStats = {
  total_orders: number;
  total_completed_orders: number;
  total_processing_orders: number;
  total_pending_orders: number;
  total_failed_orders: number;
  total_refunded_orders: number;
  total_cancelled_orders: number;
  total_revenue: number;
  today_revenue: number;
  month_revenue: number;
  total_data_orders: number;
  total_proxy_orders: number;
  total_data_sales: number;
  total_proxy_sales: number;
  total_guest_orders: number;
  total_guest_customers: number;
  total_active_customers: number;
  total_registered_customers: number;
  total_admins: number;
  total_proxy_products: number;
  total_emails_sent: number;
  total_failed_emails: number;
  top_selling_bundles: AdminTopBundle[];
  top_selling_proxy_products: AdminTopProduct[];
  order_status_distribution: AdminStatusSnapshot[];
  guest_vs_registered: AdminSeriesItem[];
  revenue_by_network: AdminSeriesItem[];
  revenue_by_proxy_type: AdminSeriesItem[];
  daily_sales: AdminTrendPoint[];
  monthly_revenue: { month: string; revenue: number }[];
};

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  referral_code: string | null;
  referral_reward_used_at: string | null;
  created_at: string;
  successful_referral_count: number;
};

type Order = {
  id: string;
  order_number: number;
  product_name: string;
  plan_name: string;
  quantity: number;
  delivery_method: DeliveryMethod;
  status: OrderStatus;
  payment_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  cd_key: string | null;
  admin_notes: string | null;
  refill_email: string | null;
  refill_password: string | null;
  refill_notes: string | null;
  proxy_type: string | null;
};

const STATUS_OPTIONS: OrderStatus[] = [
  "awaiting_payment",
  "paid",
  "processing",
  "purchasing_proxy",
  "delivering",
  "completed",
  "cancelled",
  "refunded",
];

function AdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>("processing");
  const [draftKey, setDraftKey] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const {
    data: dashboard,
    isLoading: isLoadingDashboard,
  } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => await apiFetch<AdminStats>("/api/admin/dashboard"),
  });

  const {
    data: users,
    isLoading: isLoadingUsers,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => await apiFetch<AdminUser[]>("/api/admin/users"),
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 20000,
    queryFn: async () => await apiFetch<Order[]>("/api/admin/orders"),
  });

  const isLoading = isLoadingDashboard || isLoadingUsers || isLoadingOrders;

  const mutation = useMutation({
    mutationFn: async (input: {
      orderId: string;
      status?: OrderStatus;
      cdKey?: string;
      adminNote?: string;
      refill_proof_url?: string;
      delivery_status?: string;
    }) => {
      return await apiFetch<{ ok: boolean; order: Order }>(
        `/api/admin/orders/${input.orderId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: input.status,
            cd_key: input.cdKey,
            admin_notes: input.adminNote,
            refill_proof_url: input.refill_proof_url,
            delivery_status: input.delivery_status,
          }),
        },
      );
    },
    onSuccess: () => {
      toast.success("Order updated and customer notified.");
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setSelected(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (orders ?? []).filter((o) => {
      const matchesStatus = statusFilter === "all" || o.status === statusFilter;
      const matchesTerm =
        !term ||
        String(o.order_number).includes(term) ||
        o.product_name.toLowerCase().includes(term) ||
        (o.refill_email ?? "").toLowerCase().includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [orders, search, statusFilter]);

  const topReferrers = useMemo(() => {
    return [...(users ?? [])]
      .sort((a, b) => b.successful_referral_count - a.successful_referral_count)
      .slice(0, 5);
  }, [users]);

  const statusChartData = useMemo(() => {
    return (dashboard?.order_status_distribution ?? []).map((item) => ({
      name: ORDER_STATUS_LABEL[item.status as OrderStatus] ?? item.status,
      value: item.count,
      status: item.status,
    }));
  }, [dashboard]);

  const guestChartData = dashboard?.guest_vs_registered ?? [];
  const dailySales = dashboard?.daily_sales ?? [];
  const monthlyRevenue = dashboard?.monthly_revenue ?? [];

  const orderSummaryCards = [
    {
      label: "Total orders",
      value: dashboard?.total_orders ?? "—",
      help: "All orders placed in the system",
    },
    {
      label: "Paid revenue",
      value: dashboard ? formatMoney(dashboard.total_revenue) : "—",
      help: "Revenue from paid orders",
    },
    {
      label: "Active customers",
      value: dashboard?.total_active_customers ?? "—",
      help: "Distinct registered customers who placed orders",
    },
    {
      label: "Guest orders",
      value: dashboard?.total_guest_orders ?? "—",
      help: "Orders placed without a registered account",
    },
  ];

  const performanceCards = [
    {
      label: "Completed orders",
      value: dashboard?.total_completed_orders ?? "—",
    },
    {
      label: "Pending orders",
      value: dashboard?.total_pending_orders ?? "—",
    },
    {
      label: "Failed/refunded",
      value: dashboard ? dashboard.total_failed_orders + dashboard.total_refunded_orders : "—",
    },
    {
      label: "Today revenue",
      value: dashboard ? formatMoney(dashboard.today_revenue) : "—",
    },
  ];

  function openOrder(o: Order) {
    setSelected(o);
    setDraftStatus(o.status);
    setDraftKey(o.cd_key ?? "");
    setDraftNote(o.admin_notes ?? "");
    setProofUploading(false);
    setProofUrl(null);
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin console</h1>
          <p className="mt-1 text-muted-foreground">
            Track order health, revenue trends, and fulfillment status from one place.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {orderSummaryCards.map((stat) => (
            <Card key={stat.label} className="border-border/70">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight">{stat.value}</p>
                  </div>
                </div>
                {stat.help ? <p className="mt-3 text-sm text-muted-foreground">{stat.help}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {performanceCards.map((stat) => (
            <Card key={stat.label} className="border-border/70">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card className="border-border/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <h2 className="text-2xl font-semibold">Last 14 days</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {dashboard ? `Monthly ${formatMoney(dashboard.month_revenue)}` : "Loading..."}
                </p>
              </div>
              <div className="mt-6 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailySales} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatMoney(value)} />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" fill="url(#revenueGradient)" strokeWidth={3} />
                    <Line type="monotone" dataKey="orders" stroke="#0EA5E9" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="border-border/70">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Order mix</p>
                    <h2 className="text-2xl font-semibold">Status distribution</h2>
                  </div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {statusChartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.status === "completed"
                                ? "#10B981"
                                : entry.status === "processing"
                                ? "#0EA5E9"
                                : entry.status === "paid"
                                ? "#3B82F6"
                                : entry.status === "purchasing_proxy"
                                ? "#8B5CF6"
                                : entry.status === "delivering"
                                ? "#F59E0B"
                                : entry.status === "awaiting_payment"
                                ? "#F97316"
                                : entry.status === "failed" || entry.status === "cancelled" || entry.status === "refunded"
                                ? "#EF4444"
                                : "#6B7280"
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer type</p>
                    <h2 className="text-2xl font-semibold">Guest vs registered</h2>
                  </div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={guestChartData} dataKey="value" nameKey="label" outerRadius={90} innerRadius={50}>
                        {guestChartData.map((entry, index) => (
                          <Cell key={entry.label} fill={index === 0 ? "#7C3AED" : "#14B8A6"} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Top data bundles</p>
                  <h2 className="text-2xl font-semibold">Best sellers</h2>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {(dashboard?.top_selling_bundles ?? []).map((bundle) => (
                  <div key={bundle.bundle} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{bundle.bundle}</p>
                        <p className="text-sm text-muted-foreground">Orders: {bundle.orders}</p>
                      </div>
                      <p className="text-right text-sm font-semibold">{formatMoney(bundle.revenue)}</p>
                    </div>
                  </div>
                ))}
                {(dashboard?.top_selling_bundles ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No top bundles yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Top proxy products</p>
                  <h2 className="text-2xl font-semibold">Revenue leaders</h2>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {(dashboard?.top_selling_proxy_products ?? []).map((item) => (
                  <div key={item.product} className="rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{item.product}</p>
                        <p className="text-sm text-muted-foreground">Orders: {item.orders}</p>
                      </div>
                      <p className="text-right text-sm font-semibold">{formatMoney(item.revenue)}</p>
                    </div>
                  </div>
                ))}
                {(dashboard?.top_selling_proxy_products ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No top proxy products yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-56 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search order number, product or email"
                  value={search}
                  maxLength={80}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {ORDER_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No orders match your filters.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Placed</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.order_number}</TableCell>
                        <TableCell>{o.product_name}</TableCell>
                        <TableCell>{o.plan_name}</TableCell>
                        <TableCell>{DELIVERY_LABEL[o.delivery_method]}</TableCell>
                        <TableCell>{formatMoney(o.total_amount, o.currency)}</TableCell>
                        <TableCell className="capitalize">{o.payment_status}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusTone(o.status)}>
                            {ORDER_STATUS_LABEL[o.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(o.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openOrder(o)}>
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Order #{selected.order_number}</DialogTitle>
                <DialogDescription>
                  {selected.product_name} · {selected.plan_name} · qty {selected.quantity} · {" "}
                  {DELIVERY_LABEL[selected.delivery_method]}
                </DialogDescription>
              </DialogHeader>

              {selected.delivery_method === "account_refill" ? (
                <div className="rounded-lg border border-border/70 p-4 text-sm">
                  <p className="font-medium">Account details supplied by customer</p>
                  <p className="mt-1 text-muted-foreground">Email: {selected.refill_email ?? "N/A"}</p>
                  <p className="text-muted-foreground">Password: {selected.refill_password ?? "N/A"}</p>
                  {selected.refill_notes ? (
                    <p className="text-muted-foreground">Notes: {selected.refill_notes}</p>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Refill proof (optional)</Label>
                      {proofUploading ? (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" />
                          Uploading proof...
                        </span>
                      ) : null}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={proofUploading}
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setProofUploading(true);
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const b64 = (reader.result as string).split(",")[1];
                          try {
                            const res = await apiFetch("/api/admin/uploads", {
                              method: "POST",
                              body: JSON.stringify({ filename: f.name, content_base64: b64 }),
                            });
                            setProofUrl((res as any).url);
                            toast.success("Uploaded proof");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Upload failed");
                          } finally {
                            setProofUploading(false);
                          }
                        };
                        reader.readAsDataURL(f);
                      }}
                    />
                    {proofUrl ? (
                      <div className="mt-2">
                        <img src={proofUrl} alt="refill proof" className="max-h-40 rounded" />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={draftStatus} onValueChange={(v) => setDraftStatus(v as OrderStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ORDER_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selected.delivery_method === "cd_key" ? (
                  <div className="space-y-2">
                    <Label htmlFor="cdkey">CD key to deliver</Label>
                    <Input
                      id="cdkey"
                      value={draftKey}
                      maxLength={200}
                      onChange={(e) => setDraftKey(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="note">Internal note</Label>
                  <Textarea
                    id="note"
                    value={draftNote}
                    maxLength={2000}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder="Optional note for your team"
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate({
                      orderId: selected.id,
                      status: draftStatus,
                      cdKey: draftKey,
                      adminNote: draftNote,
                      ...(proofUrl ? { refill_proof_url: proofUrl, delivery_status: "delivered" } : {}),
                    })
                  }
                >
                  {mutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Save and notify customer
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console - Brokeflex Data" },
      { name: "description", content: "Manage proxy orders, fulfillment and CD key delivery." },
      { property: "og:title", content: "Admin Console - Brokeflex Data" },
      { property: "og:description", content: "Manage proxy orders and fulfillment." },
    ],
  }),
  component: AdminPage,
});
