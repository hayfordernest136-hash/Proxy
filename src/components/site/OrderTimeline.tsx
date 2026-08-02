import { Check, Circle, Loader2 } from "lucide-react";

import { TIMELINE_LABEL, TIMELINE_STEPS, type OrderStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === "cancelled" || status === "refunded") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        This order was {status}.
      </div>
    );
  }

  const currentIndex = TIMELINE_STEPS.indexOf(status);

  return (
    <ol className="relative space-y-0">
      {TIMELINE_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border",
                  done && "border-success/40 bg-success/15 text-success",
                  active && "border-primary/50 bg-primary/15 text-primary",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3.5" />
                ) : active ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Circle className="size-2.5" />
                )}
              </span>
              {index < TIMELINE_STEPS.length - 1 ? (
                <span className={cn("my-1 w-px flex-1", done ? "bg-success/40" : "bg-border")} />
              ) : null}
            </div>
            <div className={cn("pb-6", index === TIMELINE_STEPS.length - 1 && "pb-0")}>
              <p className={cn("text-sm font-medium", !done && !active && "text-muted-foreground")}>
                {TIMELINE_LABEL[step]}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
