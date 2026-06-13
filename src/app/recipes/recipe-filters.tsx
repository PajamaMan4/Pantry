"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Option = { id: number; name: string };

const TIME_OPTIONS = [15, 30, 45, 60, 90];

export function RecipeFilters({
  tags,
  ingredients,
}: {
  tags: Option[];
  ingredients: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = React.useState(params.get("q") ?? "");

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";
  const hasFilters = [...params.keys()].length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: search });
        }}
        className="flex gap-2"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes…"
          className="w-56"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <select
        className={selectClass}
        value={params.get("tag") ?? ""}
        onChange={(e) => apply({ tag: e.target.value })}
        aria-label="Filter by tag"
      >
        <option value="">All tags</option>
        {tags.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.name}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={params.get("ingredient") ?? ""}
        onChange={(e) => apply({ ingredient: e.target.value })}
        aria-label="Filter by ingredient"
      >
        <option value="">Any ingredient</option>
        {ingredients.map((i) => (
          <option key={i.id} value={String(i.id)}>
            {i.name}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={params.get("maxTime") ?? ""}
        onChange={(e) => apply({ maxTime: e.target.value })}
        aria-label="Max total time"
      >
        <option value="">Any time</option>
        {TIME_OPTIONS.map((m) => (
          <option key={m} value={String(m)}>
            ≤ {m} min
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={params.get("fav") === "1"}
          onChange={(e) => apply({ fav: e.target.checked ? "1" : null })}
        />
        Favorites
      </label>

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            router.push(pathname);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
