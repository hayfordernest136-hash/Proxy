import { Link } from "@tanstack/react-router";

import { Brand } from "@/components/site/Brand";
import { readSiteSettings } from "@/lib/site-settings";

export function Footer() {
  const { siteTagline, siteName } = readSiteSettings();

  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Brand />
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">{siteTagline}</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Products</h3>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/data" className="hover:text-foreground">
                Data bundles
              </Link>
            </li>
            <li>
              <Link to="/products" className="hover:text-foreground">
                Proxy plans
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
            Data bundles delivered to your number in minutes. Proxy CD keys in about 2 minutes,
            account refills in about 5-7 minutes. Delivery times are estimates and may vary during
            periods of high demand or maintenance.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {siteName}. All rights reserved.
      </div>
    </footer>
  );
}
