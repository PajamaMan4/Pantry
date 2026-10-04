"use client";

import * as React from "react";
import { toast } from "sonner";
import { PencilIcon, TrashIcon, CheckIcon, XIcon, MergeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  renameTagAction,
  mergeTagAction,
  deleteTagAction,
  renameCategoryAction,
  mergeCategoryAction,
  deleteCategoryAction,
  type TaxonomyActionResult,
} from "./actions";

/** `key` is the tag id (as a string) for tags, or the category name for categories. */
export type TaxonomyItem = { key: string; name: string; count: number };

type Kind = "tag" | "category";

type KindConfig = {
  /** What the count counts, e.g. "recipe". */
  noun: string;
  /** What the thing itself is called, e.g. "tag". */
  label: string;
  empty: string;
  deleteBlurb: string;
  rename: (key: string, name: string) => Promise<TaxonomyActionResult>;
  merge: (sourceKey: string, targetKey: string) => Promise<TaxonomyActionResult>;
  remove: (key: string) => Promise<TaxonomyActionResult>;
};

const CONFIG: Record<Kind, KindConfig> = {
  tag: {
    noun: "recipe",
    label: "tag",
    empty: "No tags yet. Tags are created when you add them to a recipe.",
    deleteBlurb: "It will be removed from every recipe that uses it. The recipes themselves are kept.",
    rename: (key, name) => renameTagAction(Number(key), { name }),
    merge: (source, target) => mergeTagAction(Number(source), Number(target)),
    remove: (key) => deleteTagAction(Number(key)),
  },
  category: {
    noun: "ingredient",
    label: "category",
    empty: "No categories yet. Categories are created when you set one on an ingredient.",
    deleteBlurb: "Its ingredients are kept but become “Uncategorized”.",
    rename: (key, name) => renameCategoryAction(key, { name }),
    merge: (source, target) => mergeCategoryAction(source, target),
    remove: (key) => deleteCategoryAction(key),
  },
};

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

export function TaxonomyManager({ kind, items }: { kind: Kind; items: TaxonomyItem[] }) {
  const config = CONFIG[kind];

  if (items.length === 0) return <p className="text-sm text-muted-foreground">{config.empty}</p>;

  return (
    <ul className="max-h-80 divide-y overflow-auto rounded-lg border px-3">
      {items.map((item) => (
        <TaxonomyRow key={item.key} item={item} others={items.filter((o) => o.key !== item.key)} config={config} />
      ))}
    </ul>
  );
}

function TaxonomyRow({
  item,
  others,
  config,
}: {
  item: TaxonomyItem;
  others: TaxonomyItem[];
  config: KindConfig;
}) {
  const [editing, setEditing] = React.useState(false);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [name, setName] = React.useState(item.name);
  const [pending, startTransition] = React.useTransition();

  function save() {
    const next = name.trim();
    if (!next) return;
    startTransition(async () => {
      const res = await config.rename(item.key, next);
      if (res.ok) {
        setEditing(false);
        toast.success("Renamed");
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await config.remove(item.key);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              } else if (e.key === "Escape") {
                setName(item.name);
                setEditing(false);
              }
            }}
            className="h-8"
            autoFocus
          />
          <Button size="icon" variant="ghost" aria-label="Save" onClick={save} disabled={pending}>
            <CheckIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => {
              setName(item.name);
              setEditing(false);
            }}
            disabled={pending}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <span className="min-w-0 truncate text-sm">
            {item.name}{" "}
            <span className="text-xs text-muted-foreground">· {plural(item.count, config.noun)}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => setEditing(true)}>
              <PencilIcon className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Merge into another"
              disabled={others.length === 0}
              onClick={() => setMergeOpen(true)}
            >
              <MergeIcon className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="icon" variant="ghost" aria-label="Delete" />}>
                <TrashIcon className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{item.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>{config.deleteBlurb}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" disabled={pending} onClick={remove}>
                    {pending ? "Deleting…" : `Delete ${config.label}`}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <MergeDialog item={item} others={others} config={config} open={mergeOpen} onOpenChange={setMergeOpen} />
        </>
      )}
    </li>
  );
}

function MergeDialog({
  item,
  others,
  config,
  open,
  onOpenChange,
}: {
  item: TaxonomyItem;
  others: TaxonomyItem[];
  config: KindConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [targetKey, setTargetKey] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const target = others.find((o) => o.key === targetKey);

  function merge() {
    if (!target) return;
    startTransition(async () => {
      const res = await config.merge(item.key, target.key);
      if (res.ok) {
        onOpenChange(false);
        toast.success(`Merged “${item.name}” into “${target.name}”`);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTargetKey(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge “{item.name}” into…</DialogTitle>
          <DialogDescription>
            Every {config.noun} using “{item.name}” is switched to the {config.label} you pick, then “
            {item.name}” is deleted. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={targetKey}
          onValueChange={(v) => setTargetKey(v as string | null)}
          items={others.map((o) => ({ value: o.key, label: o.name }))}
        >
          <SelectTrigger className="w-full" disabled={pending}>
            <SelectValue placeholder={`Choose a ${config.label}…`} />
          </SelectTrigger>
          <SelectContent>
            {others.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {target && (
          <p className="text-sm text-muted-foreground">
            {plural(item.count, config.noun)} will be moved to “{target.name}”.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button onClick={merge} disabled={pending || !target}>
            {pending ? "Merging…" : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
