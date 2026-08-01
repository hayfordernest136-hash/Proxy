import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

import { readSiteSettings } from "@/lib/site-settings";

export function Brand({ compact }: { compact?: boolean }) {
  const { siteName } = readSiteSettings();
  const split = siteName.split(" ");
  const first = split[0] ?? siteName;
  const rest = split.slice(1).join(" ");

  return (
    <Link to="/" className="flex items-center gap-2">
      <span
        className={
          "grid place-items-center rounded-lg bg-primary/15 text-primary " +
          (compact ? "size-7" : "size-9")
        }
      >
        <Shield className="size-4" />
      </span>
      {!compact ? (
        <span className="text-base font-semibold tracking-tight">
          {first}
          {rest ? <span className="text-primary"> {rest}</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

export default Brand;
