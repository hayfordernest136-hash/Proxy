import { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  BellRing,
  CircleDollarSign,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Pricing Templates", to: "/admin/pricing-templates", icon: CreditCard },
  { label: "Categories", to: "/admin/categories", icon: Package },
  { label: "Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Wallet", to: "/admin/wallet", icon: Wallet },
  { label: "Transactions", to: "/admin/transactions", icon: ReceiptText },
  { label: "Support", to: "/admin/support", icon: LifeBuoy },
  { label: "Notifications", to: "/admin/notifications", icon: BellRing },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", to: "/admin/settings", icon: Settings },
] as const;

function AdminSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();

  return (
    <aside
      className={
        "fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-border/60 bg-background/95 backdrop-blur transition-all duration-200 md:sticky md:top-0 " +
        (collapsed ? "w-20" : "w-72")
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="space-y-1 overflow-hidden">
          <div className="text-sm font-semibold">ProxZone Admin</div>
          {!collapsed ? <p className="text-xs text-muted-foreground">Operations dashboard</p> : null}
        </div>
        <button
          className="rounded-md border border-border/70 bg-muted px-2 py-1 text-xs font-medium text-foreground"
          onClick={onToggle}
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition " +
                (isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted")
              }
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/60 p-4 text-xs text-muted-foreground">
        {!collapsed ? "Built for operational admin workflows." : "Admin"}
      </div>
    </aside>
  );
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div className="hidden md:block">
          <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
        ) : null}

        <div className="md:hidden">
          <button
            type="button"
            className="fixed left-4 top-4 z-50 rounded-md border border-border/70 bg-background p-2"
            onClick={() => setMobileOpen((current) => !current)}
            aria-label="Toggle mobile menu"
          >
            <Menu className="size-5" />
          </button>
        </div>

        <div
          className={
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-border/60 bg-background md:hidden " +
            (mobileOpen ? "translate-x-0" : "-translate-x-full")
          }
        >
          <div className="flex items-center justify-between border-b border-border/60 p-4">
            <div>
              <p className="text-sm font-semibold">ProxZone Admin</p>
              <p className="text-xs text-muted-foreground">Operations dashboard</p>
            </div>
            <button type="button" onClick={() => setMobileOpen(false)} className="rounded-md border border-border/70 p-2">
              <X className="size-4" />
            </button>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <main className="flex-1 md:ml-[var(--admin-sidebar-width,0px)]">
          <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6">
              <div>
                <p className="text-sm text-muted-foreground">Admin workspace</p>
                <h1 className="text-lg font-semibold tracking-tight">Operations overview</h1>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md border border-border/70 p-2">
                  <BellRing className="size-4" />
                </button>
                <button type="button" className="rounded-md border border-border/70 p-2">
                  <Settings className="size-4" />
                </button>
              </div>
            </div>
          </header>
          <div className="px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
