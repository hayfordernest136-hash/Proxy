import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const navItems = [
  { label: "Dashboard", to: "/admin" },
  { label: "Orders", to: "/admin/orders" },
  { label: "Products", to: "/admin/products" },
  { label: "Pricing Templates", to: "/admin/pricing-templates" },
  { label: "Categories", to: "/admin/categories" },
  { label: "Customers", to: "/admin/customers" },
  { label: "Wallet", to: "/admin/wallet" },
  { label: "Coupons", to: "/admin/coupons" },
  { label: "Analytics", to: "/admin/analytics" },
  { label: "Support", to: "/admin/support" },
  { label: "Settings", to: "/admin/settings" },
];

function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={
        "flex h-screen flex-col border-r border-border/60 bg-surface transition-all duration-200 " +
        (collapsed ? "w-20" : "w-72")
      }
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
        <div className="space-y-1">
          <div className="text-sm font-semibold">Admin</div>
          {!collapsed ? <p className="text-xs text-muted-foreground">Dashboard navigation</p> : null}
        </div>
        <button
          className="rounded bg-muted px-2 py-1 text-sm text-foreground"
          onClick={() => setCollapsed(!collapsed)}
          type="button"
        >
          {collapsed ? ">" : "<"}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="mb-2 block rounded-xl px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
          >
            {collapsed ? item.label.charAt(0) : item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border/60 p-4 text-xs text-muted-foreground">
        {collapsed ? "" : "Built for professional admin workflows."}
      </div>
    </aside>
  );
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
