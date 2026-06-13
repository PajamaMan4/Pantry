"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type IngredientOption = {
  id: number;
  name: string;
  defaultUnit: string | null;
};

type Props = {
  options: IngredientOption[];
  selectedName: string;
  placeholder?: string;
  /** Called on every keystroke — the row becomes a free-text name (id cleared). */
  onType: (name: string) => void;
  /** Called when an existing ingredient is chosen. */
  onSelect: (opt: IngredientOption) => void;
  /** Create-on-the-fly: resolves once the master ingredient exists. */
  onCreate: (name: string) => Promise<void>;
};

export function IngredientCombobox({
  options,
  selectedName,
  placeholder = "Search or add an ingredient…",
  onType,
  onSelect,
  onCreate,
}: Props) {
  const [query, setQuery] = React.useState(selectedName);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const filtered = React.useMemo(() => {
    const q = trimmed.toLowerCase();
    const list = q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
    return list.slice(0, 8);
  }, [options, trimmed]);

  const exactMatch = options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exactMatch;
  const itemCount = filtered.length + (showCreate ? 1 : 0);

  // Close on outside click.
  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(opt: IngredientOption) {
    setQuery(opt.name);
    setOpen(false);
    onSelect(opt);
  }

  async function create() {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
      setOpen(false);
    } finally {
      setCreating(false);
    }
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
      else if (showCreate) void create();
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
          onType(e.target.value);
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
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(opt)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left",
                  i === active && "bg-muted",
                )}
              >
                <span>{opt.name}</span>
                {opt.defaultUnit && (
                  <span className="text-xs text-muted-foreground">{opt.defaultUnit}</span>
                )}
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
                onClick={() => void create()}
                disabled={creating}
                className={cn(
                  "flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-left",
                  active === filtered.length && "bg-muted",
                )}
              >
                <span className="text-muted-foreground">{creating ? "Creating…" : "Create"}</span>
                <span className="font-medium">“{trimmed}”</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
