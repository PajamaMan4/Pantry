"use client";

import * as React from "react";
import { ListIcon, ShelvingUnitIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setListGroupingAction } from "@/app/settings/actions";

type Grouping = "none" | "location";

const OPTIONS: { value: Grouping; label: string; icon: typeof ListIcon }[] = [
  { value: "location", label: "By location", icon: ShelvingUnitIcon },
  { value: "none", label: "Alphabetical", icon: ListIcon },
];

/** Shared by /shopping and /menu to toggle whether ingredients are grouped by default storage location. */
export function ListGroupingToggle({ current }: { current: Grouping }) {
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState<Grouping>(current);

  function pick(value: Grouping) {
    setOptimistic(value);
    startTransition(async () => {
      await setListGroupingAction(value);
    });
  }

  return (
    <div className="flex items-center rounded-md border p-0.5" aria-busy={pending}>
      {OPTIONS.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => pick(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
              optimistic === o.value
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
