"use client";

import * as React from "react";
import { ListIcon, ShelvingUnitIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setInventoryViewAction } from "./actions";

type View = "alphabetical" | "location";

const OPTIONS: { value: View; label: string; icon: typeof ListIcon }[] = [
  { value: "location", label: "Inventory", icon: ShelvingUnitIcon },
  { value: "alphabetical", label: "Dictionary", icon: ListIcon },
];

export function ViewToggle({ current }: { current: View }) {
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState<View>(current);

  function pick(value: View) {
    setOptimistic(value);
    startTransition(async () => {
      await setInventoryViewAction(value);
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
