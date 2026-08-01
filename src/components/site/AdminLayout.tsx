import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

function AdminSidebar() {
  return (
    <aside className="w-64 border-r border-border/60 p-4">
      <nav className="space-y-2">
        <a href="/admin" className="block px-3 py-2 rounded hover:bg-muted">
          Dashboard
        </a>
        <a href="/admin/products" className="block px-3 py-2 rounded hover:bg-muted">
          Products
        </a>
        <a href="/admin/pricing-templates" className="block px-3 py-2 rounded hover:bg-muted">
          Pricing Templates
        </a>
        <a href="/admin/orders" className="block px-3 py-2 rounded hover:bg-muted">
          Orders
        </a>
        <a href="/admin/customers" className="block px-3 py-2 rounded hover:bg-muted">
          Customers
        </a>
        <a href="/admin/settings" className="block px-3 py-2 rounded hover:bg-muted">
          Settings
        </a>
      </nav>
    </aside>
  );
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto flex">
        <AdminSidebar />
        <main className="flex-1 p-6">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export default AdminLayout;
