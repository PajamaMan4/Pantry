"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DisplaySystem } from "@/lib/domain/scaling";

const OPTIONS: { value: DisplaySystem; label: string }[] = [
  { value: "original", label: "As written" },
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
];

/** Three-way display-unit toggle that stores its choice in the `units` query param. */
export function UnitSystemToggle({ current }: { current: DisplaySystem }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(value: DisplaySystem) {
    const next = new URLSearchParams(params.toString());
    next.set("units", value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex items-center rounded-md border p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => set(o.value)}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
            current === o.value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
