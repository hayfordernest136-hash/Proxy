import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";

export function Brand({ compact }: { compact?: boolean }) {
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
          Broke<span className="text-primary">Flex</span>
        </span>
      ) : null}
    </Link>
  );
}

export default Brand;
