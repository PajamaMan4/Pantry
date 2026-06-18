"use client";

import * as React from "react";
import { toast } from "sonner";
import { MergeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { mergeIngredientAction } from "./actions";

/**
 * Absorb a duplicate ingredient into the one being viewed. The chosen
 * duplicate's recipes, inventory, prices, and history move here, and the
 * duplicate is deleted. On success the action redirects (refreshing this page).
 */
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
  const [sourceId, setSourceId] = React.useState<string>("");

  function onMerge() {
    if (!sourceId) return;
    startTransition(async () => {
      const res = await mergeIngredientAction(Number(sourceId), currentId);
      // Success redirects (throws); we only get here on failure.
      if (res && !res.ok) toast.error(res.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <MergeIcon className="size-4" /> Merge duplicate
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge a duplicate into “{currentName}”</DialogTitle>
          <DialogDescription>
            Pick a duplicate ingredient. Its recipes, inventory, prices, and history move onto “
            {currentName}”, and the duplicate is deleted. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">There are no other ingredients to merge.</p>
        ) : (
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Select a duplicate…</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button onClick={onMerge} disabled={pending || !sourceId}>
            {pending ? "Merging…" : "Merge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
