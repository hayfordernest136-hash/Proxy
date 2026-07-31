import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/site/Brand";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Brand />
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            Premium residential, mobile and datacenter proxies delivered fast, with
            human support and local payment options.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Products</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/products" className="hover:text-foreground">
                All proxies
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-foreground">
                Pricing
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Account</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/auth" className="hover:text-foreground">
                Log in
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="hover:text-foreground">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/support" className="hover:text-foreground">
                Support
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Delivery</h3>
          <p className="mt-4 text-sm text-muted-foreground">
            CD Key delivery in about 2 minutes. Account refills in about 5-7 minutes.
            Delivery times are estimates and may vary during periods of high demand or
            maintenance.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BrokeFlex. All rights reserved.
      </div>
    </footer>
  );
}
