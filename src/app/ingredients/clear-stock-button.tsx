"use client";

import * as React from "react";
import { TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { clearStockAction } from "./actions";

export function ClearStockButton({ ingredientId, name }: { ingredientId: number; name: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label={`Clear stock for ${name}`} />}>
        <TrashIcon className="size-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear stock for {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes all stored inventory for {name} (sets it to “not in stock”). The ingredient
            and its price history are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(async () => void (await clearStockAction(ingredientId)))}
          >
            {pending ? "Clearing…" : "Clear stock"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
