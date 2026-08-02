import { Link } from "@tanstack/react-router";

import { readSiteSettings } from "@/lib/site-settings";

export function Brand({ compact }: { compact?: boolean }) {
  const { siteName } = readSiteSettings();
  // Brand renders "Broke" + yellow "Flex" by default.
  // Falls back gracefully for any other site name.
  const defaultMatch = /^broke\s*(flex.*)?$/i.exec(siteName.trim());
  const first = defaultMatch ? "Broke" : (siteName.trim().split(" ")[0] ?? siteName);
  const rest = defaultMatch ? "Flex" : siteName.trim().split(" ").slice(1).join(" ");

  return (
    <Link to="/" className="flex min-w-0 flex-shrink-0 items-center gap-2 whitespace-nowrap">
      <span
        className={
          "grid shrink-0 place-items-center rounded-xl border border-border/70 bg-background/90 p-1 shadow-sm " +
          (compact ? "size-8" : "size-10")
        }
      >
        <img
          src="/logo.png"
          alt="Logo"
          className={compact ? "size-6 rounded-md object-cover" : "size-8 rounded-lg object-cover"}
        />
      </span>
      {!compact ? (
        <span className="min-w-0 whitespace-nowrap text-base font-semibold tracking-tight sm:text-lg">
          {first}
          {rest ? <span className="text-primary"> {rest}</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

export default Brand;
