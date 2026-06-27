"use client";

import * as React from "react";
import { toast } from "sonner";
import { MergeIcon, XIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { mergeManyIngredientsAction } from "./actions";

export function MergeIngredientDialog({
  currentId,
  currentName,
  others,
}: {
  currentId: number;
  currentName: string;
  others: { id: number; name: string }[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [sourceIds, setSourceIds] = React.useState<Set<number>>(new Set());
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? others.filter((o) => o.name.toLowerCase().includes(q)) : others;
  }, [others, query]);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function toggle(id: number) {
    setSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) toggle(filtered[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function onMerge() {
    if (sourceIds.size === 0) return;
    startTransition(async () => {
      const res = await mergeManyIngredientsAction(Array.from(sourceIds), currentId);
      if (res && !res.ok) toast.error(res.error);
    });
  }

  const mergeLabel =
    sourceIds.size === 0
      ? "Merge"
      : sourceIds.size === 1
        ? "Merge"
        : `Merge ${sourceIds.size} duplicates`;

  const selectedItems = others.filter((o) => sourceIds.has(o.id));

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MergeIcon className="size-4" /> Merge duplicate
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge duplicates into "{currentName}"</DialogTitle>
          <DialogDescription>
            Pick one or more duplicate ingredients. Their recipes, inventory, prices, and history
            move onto "{currentName}", and the duplicates are deleted. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no other ingredients to merge.</p>
        ) : (
          <div className="space-y-2">
            <div ref={wrapRef} className="relative">
              <Input
                value={query}
                placeholder="Search ingredients…"
                autoComplete="off"
                disabled={pending}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
              />

              {open && filtered.length > 0 && (
                <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md">
                  {filtered.map((opt, i) => {
                    const selected = sourceIds.has(opt.id);
                    return (
                      <li key={opt.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => toggle(opt.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left",
                            i === active && "bg-muted",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                              selected && "bg-primary border-primary text-primary-foreground",
                            )}
                          >
                            {selected && <CheckIcon className="size-3" />}
                          </span>
                          <span>{opt.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {selectedItems.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedItems.map((o) => (
                  <Badge key={o.id} variant="secondary" className="gap-1 pr-1">
                    {o.name}
                    <button
                      type="button"
                      onClick={() => toggle(o.id)}
                      className="rounded-full hover:bg-muted"
                      aria-label={`Remove ${o.name}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button onClick={onMerge} disabled={pending || sourceIds.size === 0}>
            {pending ? "Merging…" : mergeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
