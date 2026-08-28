"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { locationKey } from "@/lib/domain/inventory-edit";

export type EditTab = { id: number | null; name: string; count: number };

/**
 * Hand-rolled tab strip — there's no shadcn Tabs primitive in this app, and
 * the draft lives in the parent, so unmounting an inactive panel loses
 * nothing. Same shell family as view-toggle.tsx / unit-system-toggle.tsx.
 */
export function LocationTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: EditTab[];
  active: number | null;
  onChange: (id: number | null) => void;
}) {
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (activeIndex + dir + tabs.length) % tabs.length;
    const btn = e.currentTarget.parentElement?.children[next] as HTMLButtonElement | undefined;
    onChange(tabs[next]?.id ?? null);
    btn?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Storage locations"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2"
    >
      {tabs.map((t) => {
        const isActive = t.id === active;
        const key = locationKey(t.id);
        return (
          <button
            key={key}
            role="tab"
            type="button"
            id={`inv-tab-${key}`}
            aria-controls={`inv-panel-${key}`}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={onKeyDown}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "border-input bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.name}
            <Badge variant="secondary">{t.count}</Badge>
          </button>
        );
      })}
    </div>
  );
}
