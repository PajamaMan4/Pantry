"use client";

import * as React from "react";
import { ListIcon, ShelvingUnitIcon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setListGroupingAction } from "@/app/settings/actions";

type Grouping = "none" | "grouped";

/** Shared by /shopping and /menu to toggle whether ingredients are grouped —
 *  by default storage location, or by category when locations are hidden. */
export function ListGroupingToggle({ current, showLocations }: { current: Grouping; showLocations: boolean }) {
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState<Grouping>(current);

  const options: { value: Grouping; label: string; icon: typeof ListIcon }[] = [
    { value: "grouped", label: showLocations ? "By location" : "By category", icon: showLocations ? ShelvingUnitIcon : TagIcon },
    { value: "none", label: "Alphabetical", icon: ListIcon },
  ];

  function pick(value: Grouping) {
    setOptimistic(value);
    startTransition(async () => {
      await setListGroupingAction(value);
    });
  }

  return (
    <div className="flex items-center rounded-md border p-0.5" aria-busy={pending}>
      {options.map((o) => {
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
