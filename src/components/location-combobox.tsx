"use client";

import * as React from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createLocationAction } from "@/app/settings/actions";

export type LocationOption = { id: number; name: string };

/**
 * Storage-location combobox: type to filter existing locations, or type a new
 * name and confirm to create it on the fly. Consistent with the ingredient
 * combobox pattern used elsewhere in the app.
 */
export function LocationCombobox({
  options,
  value,
  onChange,
  placeholder = "Location…",
}: {
  options: LocationOption[];
  value: { id: number | null; name: string };
  onChange: (v: { id: number | null; name: string }) => void;
  placeholder?: string;
}) {
  const [locations, setLocations] = React.useState<LocationOption[]>(options);
  const [query, setQuery] = React.useState(value.name);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [creating, setCreating] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const filtered = React.useMemo(() => {
    const q = trimmed.toLowerCase();
    return (q ? locations.filter((o) => o.name.toLowerCase().includes(q)) : locations).slice(0, 8);
  }, [locations, trimmed]);
  const exact = locations.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = trimmed.length > 0 && !exact;
  const itemCount = filtered.length + (showCreate ? 1 : 0);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function choose(opt: LocationOption) {
    setQuery(opt.name);
    setOpen(false);
    onChange({ id: opt.id, name: opt.name });
  }

  async function create() {
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const res = await createLocationAction({ name: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLocations((prev) => (prev.some((o) => o.id === res.location.id) ? prev : [...prev, res.location]));
      setQuery(res.location.name);
      setOpen(false);
      onChange({ id: res.location.id, name: res.location.name });
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
          onChange({ id: null, name: e.target.value });
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
                  "w-full rounded-sm px-2 py-1.5 text-left",
                  i === active && "bg-muted",
                )}
              >
                {opt.name}
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
