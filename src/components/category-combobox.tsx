"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Ingredient-category combobox: type to filter existing categories, or type a
 * new one to use it as-is. Category is free text with no dedicated table (see
 * listCategories in src/lib/db/ingredients.ts), so unlike LocationCombobox
 * there's no create action to call — the typed value is simply the value.
 */
export function CategoryCombobox({
  options,
  value,
  onChange,
  placeholder = "Category…",
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = React.useState(value);
  // Re-sync the visible text when `value` changes from outside.
  React.useEffect(() => {
    setQuery(value);
  }, [value]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const filtered = React.useMemo(() => {
    const q = trimmed.toLowerCase();
    return (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 8);
  }, [options, trimmed]);
  const exact = options.some((o) => o.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exact;
  const itemCount = filtered.length + (showCreate ? 1 : 0);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(opt: string) {
    setQuery(opt);
    setOpen(false);
    onChange(opt);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(0, itemCount - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < filtered.length) choose(filtered[active]);
      else if (showCreate) choose(trimmed);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          onChange(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && itemCount > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          role="listbox"
        >
          {filtered.map((opt, i) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
                className={cn(
                  "w-full rounded-sm px-2 py-1.5 text-left",
                  i === active && "bg-muted",
                )}
              >
                {opt}
              </button>
            </li>
          ))}
          {showCreate && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={active === filtered.length}
                onMouseEnter={() => setActive(filtered.length)}
                onClick={() => choose(trimmed)}
                className={cn(
                  "flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-left",
                  active === filtered.length && "bg-muted",
                )}
              >
                <span className="text-muted-foreground">Use</span>
                <span className="font-medium">“{trimmed}”</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
