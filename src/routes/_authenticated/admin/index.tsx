import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { Loader2, Search, Edit, Trash } from "lucide-react";
import { toast } from "sonner";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Switch } from "@/components/ui/switch";
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

type AdminStats = {
  total_users: number;
  total_admins: number;
  total_orders: number;
  total_revenue: number;
  paid_orders: number;
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
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

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — BrokeFlex" },
      { name: "description", content: "Manage proxy orders, fulfilment and CD key delivery." },
      { property: "og:title", content: "Admin Console — BrokeFlex" },
      { property: "og:description", content: "Manage proxy orders and fulfilment." },
    ],
  }),
  component: AdminPage,
});

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
  const [productDialog, setProductDialog] = useState<{ open: boolean; product: any | null }>({ open: false, product: null });
  const [productDraft, setProductDraft] = useState<any>({ name: '', description: '', proxy_type: '', location: '', duration_days: null, image_url: '', availability_status: 'available', features: [], is_active: 1, supports_cd_key: 1, supports_account_refill: 1, prices: [] });
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<{ productId: number; plan: any } | null>(null);
  const [planDraft, setPlanDraft] = useState<any>(null);

  const {
    data: dashboard,
    isLoading: isLoadingDashboard,
  } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      return await apiFetch<AdminStats>("/api/admin/dashboard");
    },
  });

  const {
    data: users,
    isLoading: isLoadingUsers,
  } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      return await apiFetch<AdminUser[]>("/api/admin/users");
    },
  });

  const routeSearch = Route.useSearch();

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 20000,
    queryFn: async () => {
      return await apiFetch<Order[]>("/api/admin/orders");
    },
  });

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => await apiFetch<any[]>('/api/admin/products'),
  });

  // Open product dialog when admin console is opened with ?manage=<slug>
  useEffect(() => {
    if (routeSearch?.manage && products) {
      const slug = String(routeSearch.manage);
      const p = (products as any[]).find((x) => x.slug === slug);
      if (p) {
        // normalize fields to ensure controlled inputs
        const normalized = {
          ...p,
          description: p.description ?? '',
          features: Array.isArray(p.features) ? p.features : (p.features ? JSON.parse(p.features) : []),
          prices: (p.prices ?? []).map((r: any) => ({ id: r.id, number_of_ips: Number(r.number_of_ips ?? 0), price: Number(r.price ?? 0), currency: r.currency ?? 'GHS' })),
          duration_days: p.duration_days ?? null,
          image_url: p.image_url ?? '',
          is_active: p.is_active ? 1 : 0,
          supports_cd_key: p.supports_cd_key ? 1 : 0,
          supports_account_refill: p.supports_account_refill ? 1 : 0,
        };
        setProductDialog({ open: true, product: p });
        setProductDraft(normalized);
      }
    }
  }, [routeSearch, products]);

  const isLoading = isLoadingDashboard || isLoadingUsers || isLoadingOrders;

  const promoteUserMutation = useMutation({
    mutationFn: async (input: { userId: number; role: 'admin' | 'user' }) => {
      return await apiFetch<{ ok: true; user: { id: number; role: string } }>(
        `/api/admin/users/${input.userId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: input.role }),
        },
      );
    },
    onSuccess: () => {
      toast.success('User role updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Unable to update role'),
  });

  const mutation = useMutation({
    mutationFn: async (input: {
      orderId: string;
      status?: OrderStatus;
      cdKey?: string;
      adminNote?: string;
    }) => {
      return await apiFetch<{ ok: boolean; order: Order }>(
        `/api/admin/orders/${input.orderId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: input.status,
            cd_key: input.cdKey,
            admin_notes: input.adminNote,
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

  const productMutation = useMutation({
    mutationFn: async (input: { action: string; id?: number; body?: any; productId?: number }) => {
      if (input.action === 'create') {
        return await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(input.body) });
      }
      if (input.action === 'update') {
        return await apiFetch(`/api/admin/products/${input.id}`, { method: 'PATCH', body: JSON.stringify(input.body) });
      }
      if (input.action === 'delete') {
        return await apiFetch(`/api/admin/products/${input.id}`, { method: 'DELETE' });
      }
      if (input.action === 'createPlan') {
        return await apiFetch(`/api/admin/products/${input.productId}/plans`, { method: 'POST', body: JSON.stringify(input.body) });
      }
      if (input.action === 'updatePlan') {
        return await apiFetch(`/api/admin/plans/${input.id}`, { method: 'PATCH', body: JSON.stringify(input.body) });
      }
      if (input.action === 'deletePlan') {
        return await apiFetch(`/api/admin/plans/${input.id}`, { method: 'DELETE' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product updated');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Product update failed'),
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

  const stats = useMemo(() => {
    const all = orders ?? [];
    return {
      total: all.length,
      pending: all.filter(
        (o) => !["completed", "cancelled", "refunded"].includes(o.status),
      ).length,
      completed: all.filter((o) => o.status === "completed").length,
      revenue: all
        .filter((o) => o.payment_status === "paid")
        .reduce((s, o) => s + Number(o.total_amount), 0),
    };
  }, [orders]);

  const userColumns = [
    { label: 'Name', key: 'name' as const },
    { label: 'Email', key: 'email' as const },
    { label: 'Role', key: 'role' as const },
    { label: 'Referrals', key: 'successful_referral_count' as const },
    { label: 'Referral status', key: 'referral_reward_used_at' as const },
  ];

  function openOrder(o: Order) {
    setSelected(o);
    setDraftStatus(o.status);
    setDraftKey(o.cd_key ?? "");
    setDraftNote(o.admin_notes ?? "");
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-12 sm:px-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin console</h1>
          <p className="mt-1 text-muted-foreground">
            Fulfil orders manually, deliver CD keys and keep customers updated.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total orders", value: stats.total },
            { label: "Pending fulfilment", value: stats.pending },
            { label: "Completed", value: stats.completed },
            { label: "Revenue (paid)", value: formatMoney(stats.revenue) },
          ].map((s) => (
            <Card key={s.label} className="border-border/70">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Customers</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {dashboard?.total_users ?? '—'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {dashboard?.total_admins ?? 0} admins · {dashboard?.total_referrals ?? 0} referrals
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Business</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">
                {formatMoney(dashboard?.total_revenue ?? 0)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {dashboard?.paid_orders ?? 0} paid orders · {dashboard?.completed_referrals ?? 0} completed referrals
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/70">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Latest users</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {users ? users.length : '—'} accounts
                </p>
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : users && users.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Referrals</TableHead>
                      <TableHead>Referral reward</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="capitalize">{user.role}</TableCell>
                        <TableCell>{user.successful_referral_count}</TableCell>
                        <TableCell>{user.referral_reward_used_at ? 'Used' : 'Available'}</TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(user.created_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant={user.role === 'admin' ? 'outline' : 'secondary'}
                            onClick={() =>
                              promoteUserMutation.mutate({
                                userId: user.id,
                                role: user.role === 'admin' ? 'user' : 'admin',
                              })
                            }
                            disabled={promoteUserMutation.isPending}
                          >
                            {user.role === 'admin' ? 'Demote' : 'Promote'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No users found.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Products management */}
        <Card className="border-border/70">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Products</p>
                <p className="mt-1 text-lg font-semibold text-foreground">{products ? products.length : '—'} products</p>
              </div>
              <div>
                <Button size="sm" onClick={() => { setProductDialog({ open: true, product: null }); setProductDraft({ name: '', description: '', proxy_type: '', location: '', duration_days: null, image_url: '', availability_status: 'available', features: [], is_active: 1, prices: [] }); }}>Create product</Button>
              </div>
            </div>

            <div className="mt-4">
              {isLoadingProducts ? (
                <Skeleton className="h-32 rounded-md" />
              ) : products && products.length > 0 ? (
                <div className="space-y-2">
                  {(products as any[]).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded border border-border/60 p-3">
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-muted-foreground">{p.proxy_type} · {p.location}</div>
                            {p.prices && p.prices.length ? (
                              <div className="mt-2">
                                <div className="text-xs font-semibold text-muted-foreground">IP Pricing</div>
                                <div className="mt-1 space-y-2">
                                  {p.prices.map((price: any) => (
                                    <div key={price.id} className="flex items-center justify-between">
                                      <div>
                                        <div className="text-sm font-medium">{price.number_of_ips} IPs</div>
                                        <div className="text-xs text-muted-foreground">{formatMoney(price.price)} · {price.currency}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={!!p.is_active} onCheckedChange={(v) => productMutation.mutate({ action: 'update', id: p.id, body: { is_active: v ? 1 : 0 } })} />
                        
                        <Button size="sm" variant="outline" onClick={() => {
                          const normalized = {
                            ...p,
                            description: p.description ?? '',
                            features: Array.isArray(p.features) ? p.features : (p.features ? JSON.parse(p.features) : []),
                            prices: (p.prices ?? []).map((r: any) => ({ id: r.id, number_of_ips: Number(r.number_of_ips ?? 0), price: Number(r.price ?? 0), currency: r.currency ?? 'GHS' })),
                            duration_days: p.duration_days ?? null,
                            image_url: p.image_url ?? '',
                            is_active: p.is_active ? 1 : 0,
                          };
                          setProductDialog({ open: true, product: p }); setProductDraft(normalized);
                        }}>Edit</Button>
                        <Button size="sm" variant="destructive" onClick={() => productMutation.mutate({ action: 'delete', id: p.id })}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-6 text-sm text-muted-foreground">No products found.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders list */}
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

      <Dialog open={productDialog.open} onOpenChange={(open) => !open && setProductDialog({ open: false, product: null })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{productDialog.product ? 'Edit product' : 'Create product'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Input placeholder="Name" value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} />
            <Textarea placeholder="Description" value={productDraft.description} onChange={(e) => setProductDraft({ ...productDraft, description: e.target.value })} />
            <div className="flex gap-2">
              <Input placeholder="Proxy type" value={productDraft.proxy_type} onChange={(e) => setProductDraft({ ...productDraft, proxy_type: e.target.value })} />
              <Input placeholder="Location" value={productDraft.location} onChange={(e) => setProductDraft({ ...productDraft, location: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Duration days" value={productDraft.duration_days ?? ''} onChange={(e) => setProductDraft({ ...productDraft, duration_days: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <Input placeholder="Image URL" value={productDraft.image_url ?? ''} onChange={(e) => setProductDraft({ ...productDraft, image_url: e.target.value })} />
            <div className="flex items-center gap-2">
              <Label className="text-sm">Available</Label>
              <Switch checked={!!productDraft.is_active} onCheckedChange={(v) => setProductDraft({ ...productDraft, is_active: v ? 1 : 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Supports CD Key</Label>
              <Switch checked={!!productDraft.supports_cd_key} onCheckedChange={(v) => setProductDraft({ ...productDraft, supports_cd_key: v ? 1 : 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Supports Account Refill</Label>
              <Switch checked={!!productDraft.supports_account_refill} onCheckedChange={(v) => setProductDraft({ ...productDraft, supports_account_refill: v ? 1 : 0 })} />
            </div>
            <Input placeholder="Features (comma separated)" value={productDraft.features?.join(', ') ?? ''} onChange={(e) => setProductDraft({ ...productDraft, features: e.target.value.split(',').map((s:any) => s.trim()).filter(Boolean) })} />

            {/* IP Pricing section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">IP Pricing</Label>
                <Button size="sm" onClick={() => setProductDraft({ ...productDraft, prices: [ ...(productDraft.prices ?? []), { number_of_ips: 10, price: 0, currency: 'GHS' } ] })}>
                  Add Row
                </Button>
              </div>
              <div className="space-y-2">
                {(productDraft.prices ?? []).map((row: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={row.number_of_ips} onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : 0;
                      const copy = [...(productDraft.prices ?? [])]; copy[idx] = { ...copy[idx], number_of_ips: v }; setProductDraft({ ...productDraft, prices: copy });
                    }} className="w-32" placeholder="Number of IPs" />
                    <Input value={row.price} onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : 0;
                      const copy = [...(productDraft.prices ?? [])]; copy[idx] = { ...copy[idx], price: v }; setProductDraft({ ...productDraft, prices: copy });
                    }} className="w-32" placeholder="Price (GHS)" />
                    <Button size="sm" variant="destructive" onClick={() => {
                      const copy = [...(productDraft.prices ?? [])]; copy.splice(idx, 1); setProductDraft({ ...productDraft, prices: copy });
                    }}>Delete</Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setProductDialog({ open: false, product: null })}>Cancel</Button>
              <Button onClick={async () => {
                const body = { ...productDraft };
                console.log('Admin saving product payload:', body);
                try {
                  if (productDialog.product) {
                    await productMutation.mutateAsync({ action: 'update', id: productDialog.product.id, body });
                    toast.success('Product saved');
                  } else {
                    await productMutation.mutateAsync({ action: 'create', body });
                    toast.success('Product created');
                  }
                } catch (e) {
                  console.error('Product save failed:', e);
                  toast.error(e instanceof Error ? e.message : 'Unable to save product');
                } finally {
                  setProductDialog({ open: false, product: null });
                }
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>Order #{selected.order_number}</DialogTitle>
                <DialogDescription>
                  {selected.product_name} · {selected.plan_name} · qty {selected.quantity} ·{" "}
                  {DELIVERY_LABEL[selected.delivery_method]}
                </DialogDescription>
              </DialogHeader>

              {selected.delivery_method === "account_refill" ? (
                <div className="rounded-lg border border-border/70 p-4 text-sm">
                  <p className="font-medium">Account details supplied by customer</p>
                  <p className="mt-1 text-muted-foreground">
                    Email: {selected.refill_email ?? "—"}
                  </p>
                  <p className="text-muted-foreground">
                    Password: {selected.refill_password ?? "—"}
                  </p>
                  {selected.refill_notes ? (
                    <p className="text-muted-foreground">Notes: {selected.refill_notes}</p>
                  ) : null}

              {selected.delivery_method === "account_refill" ? (
                <div className="space-y-2">
                  <Label>Refill proof (optional)</Label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setProofUploading(true);
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const b64 = (reader.result as string).split(',')[1];
                        try {
                          const res = await apiFetch('/api/admin/uploads', {
                            method: 'POST',
                            body: JSON.stringify({ filename: f.name, content_base64: b64 }),
                          });
                          setProofUrl((res as any).url);
                          toast.success('Uploaded proof');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Upload failed');
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
              ) : null}
                </div>
              ) : null}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={draftStatus}
                    onValueChange={(v) => setDraftStatus(v as OrderStatus)}
                  >
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
                      // if uploaded proof exists, include URL and set delivery_status to delivered
                      ...(proofUrl ? { refill_proof_url: proofUrl, delivery_status: 'delivered' } : {}),
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
