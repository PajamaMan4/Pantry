"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";
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
import { deleteIngredientAction } from "./actions";

export function DeleteIngredientDialog({
  id,
  name,
  recipeNames,
}: {
  id: number;
  name: string;
  recipeNames: string[];
}) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2Icon className="size-4" /> Delete ingredient
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
          <DialogDescription>
            This permanently removes the ingredient and all of its inventory and price history. It
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {recipeNames.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium">This may break {recipeNames.length} recipe{recipeNames.length === 1 ? "" : "s"}:</p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {recipeNames.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No recipes use this ingredient.</p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(async () => void (await deleteIngredientAction(id)))}
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
