"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { XIcon, ChevronDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Option = { id: number; name: string };

const TIME_OPTIONS = [15, 30, 45, 60, 90];

export function RecipeFilters({
  tags,
  ingredients,
  sort,
}: {
  tags: Option[];
  ingredients: Option[];
  sort: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [search, setSearch] = React.useState(params.get("q") ?? "");

  // Multi-tag state
  const selectedTagIds = React.useMemo(
    () =>
      params
        .getAll("tag")
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    [params],
  );
  const [tagOpen, setTagOpen] = React.useState(false);
  const [tagQuery, setTagQuery] = React.useState("");
  const tagRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (tagRef.current && !tagRef.current.contains(e.target as Node)) setTagOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filteredTags = React.useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    const available = tags.filter((t) => !selectedTagIds.includes(t.id));
    return q ? available.filter((t) => t.name.toLowerCase().includes(q)) : available;
  }, [tags, selectedTagIds, tagQuery]);

  // Multi-ingredient state
  const selectedIngredientIds = React.useMemo(
    () =>
      params
        .getAll("ingredient")
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0),
    [params],
  );
  const [ingredientOpen, setIngredientOpen] = React.useState(false);
  const [ingredientQuery, setIngredientQuery] = React.useState("");
  const ingredientRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ingredientRef.current && !ingredientRef.current.contains(e.target as Node)) setIngredientOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const filteredIngredients = React.useMemo(() => {
    const q = ingredientQuery.trim().toLowerCase();
    const available = ingredients.filter((i) => !selectedIngredientIds.includes(i.id));
    return q ? available.filter((i) => i.name.toLowerCase().includes(q)) : available;
  }, [ingredients, selectedIngredientIds, ingredientQuery]);

  function buildUrl(updates: { tags?: number[]; ingredients?: number[]; q?: string | null; maxTime?: string | null; fav?: string | null }) {
    const next = new URLSearchParams();
    if (sort !== "alpha") next.set("sort", sort);

    const newQ = "q" in updates ? updates.q : params.get("q");
    if (newQ) next.set("q", newQ);

    const newTagIds = updates.tags ?? selectedTagIds;
    for (const id of newTagIds) next.append("tag", String(id));

    const newIngredientIds = updates.ingredients ?? selectedIngredientIds;
    for (const id of newIngredientIds) next.append("ingredient", String(id));

    const newMaxTime = "maxTime" in updates ? updates.maxTime : params.get("maxTime");
    if (newMaxTime) next.set("maxTime", newMaxTime);

    const newFav = "fav" in updates ? updates.fav : params.get("fav");
    if (newFav) next.set("fav", newFav);

    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function addTag(id: number) {
    setTagQuery("");
    setTagOpen(false);
    router.push(buildUrl({ tags: [...selectedTagIds, id] }));
  }

  function removeTag(id: number) {
    router.push(buildUrl({ tags: selectedTagIds.filter((t) => t !== id) }));
  }

  function addIngredient(id: number) {
    setIngredientQuery("");
    setIngredientOpen(false);
    router.push(buildUrl({ ingredients: [...selectedIngredientIds, id] }));
  }

  function removeIngredient(id: number) {
    router.push(buildUrl({ ingredients: selectedIngredientIds.filter((i) => i !== id) }));
  }

  const hasFilters = params.get("q") || selectedTagIds.length > 0 || selectedIngredientIds.length > 0 || params.get("maxTime") || params.get("fav");
  const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          router.push(buildUrl({ q: search }));
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

      {/* Multi-tag combobox */}
      <div ref={tagRef} className="relative">
        <div
          className={cn(
            "flex min-h-9 min-w-[8rem] flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm cursor-pointer",
          )}
          onClick={() => {
            setTagOpen((o) => !o);
            setTagQuery("");
          }}
        >
          {selectedTagIds.length === 0 && !tagOpen && (
            <span className="text-muted-foreground">All tags</span>
          )}
          {selectedTagIds.map((id) => {
            const tag = tags.find((t) => t.id === id);
            if (!tag) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1 text-xs">
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(id);
                  }}
                  className="rounded-sm hover:bg-muted-foreground/20"
                  aria-label={`Remove ${tag.name}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            );
          })}
          {tagOpen ? (
            <input
              autoFocus
              value={tagQuery}
              onChange={(e) => setTagQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Filter tags…"
              className="min-w-[5rem] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          ) : (
            <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground" />
          )}
        </div>

        {tagOpen && (
          <ul className="absolute z-50 mt-1 max-h-48 w-full min-w-[10rem] overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md">
            {filteredTags.length === 0 ? (
              <li className="px-2 py-1.5 text-muted-foreground">No tags</li>
            ) : (
              filteredTags.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => addTag(t.id)}
                    className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                  >
                    {t.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Multi-ingredient combobox */}
      <div ref={ingredientRef} className="relative">
        <div
          className={cn(
            "flex min-h-9 min-w-[8rem] flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm cursor-pointer",
          )}
          onClick={() => {
            setIngredientOpen((o) => !o);
            setIngredientQuery("");
          }}
        >
          {selectedIngredientIds.length === 0 && !ingredientOpen && (
            <span className="text-muted-foreground">All ingredients</span>
          )}
          {selectedIngredientIds.map((id) => {
            const ingredient = ingredients.find((i) => i.id === id);
            if (!ingredient) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1 text-xs">
                {ingredient.name}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeIngredient(id);
                  }}
                  className="rounded-sm hover:bg-muted-foreground/20"
                  aria-label={`Remove ${ingredient.name}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            );
          })}
          {ingredientOpen ? (
            <input
              autoFocus
              value={ingredientQuery}
              onChange={(e) => setIngredientQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Filter ingredients…"
              className="min-w-[5rem] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          ) : (
            <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground" />
          )}
        </div>

        {ingredientOpen && (
          <ul className="absolute z-50 mt-1 max-h-48 w-full min-w-[10rem] overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md">
            {filteredIngredients.length === 0 ? (
              <li className="px-2 py-1.5 text-muted-foreground">No ingredients</li>
            ) : (
              filteredIngredients.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => addIngredient(i.id)}
                    className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-muted"
                  >
                    {i.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <select
        className={selectClass}
        value={params.get("maxTime") ?? ""}
        onChange={(e) => router.push(buildUrl({ maxTime: e.target.value || null }))}
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
          onChange={(e) => router.push(buildUrl({ fav: e.target.checked ? "1" : null }))}
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
            const next = new URLSearchParams();
            if (sort !== "alpha") next.set("sort", sort);
            const qs = next.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
          }}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
