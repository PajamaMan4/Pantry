"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChefHatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatQuantityText } from "@/lib/domain/format";
import { planCook, type CookIngredientInput, type CookStockRow, type CookLine } from "@/lib/domain/cook";
import { cookThisRecipeAction, undoCookAction } from "./cook-actions";

export function CookButton({
  recipeId,
  baseServings,
  servings,
  ingredients,
  stock,
}: {
  recipeId: number;
  baseServings: number;
  servings: number;
  ingredients: CookIngredientInput[];
  stock: { ingredientId: number; rows: CookStockRow[] }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [servingsMade, setServingsMade] = React.useState(String(servings));
  const [pending, startTransition] = React.useTransition();

  // Reset the field to the current displayed servings whenever the dialog opens.
  function onOpenChange(next: boolean) {
    if (next) setServingsMade(String(servings));
    setOpen(next);
  }

  const stockMap = React.useMemo(
    () => new Map(stock.map((s) => [s.ingredientId, s.rows])),
    [stock],
  );
  const made = Number(servingsMade);
  const factor = baseServings > 0 && made > 0 ? made / baseServings : 1;
  const plan = React.useMemo(() => planCook(ingredients, stockMap, factor), [ingredients, stockMap, factor]);

  function doUndo(cookLogId: number) {
    startTransition(async () => {
      await undoCookAction(cookLogId, recipeId);
      toast.success("Cook undone — inventory restored");
    });
  }

  function confirm() {
    startTransition(async () => {
      const res = await cookThisRecipeAction(recipeId, servingsMade);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(`Logged · ${res.deducted} item${res.deducted === 1 ? "" : "s"} deducted`, {
        action: { label: "Undo", onClick: () => doUndo(res.cookLogId) },
        duration: 8000,
      });
    });
  }

  const shown = plan.lines
    .filter((l) => l.status !== "skipped" || l.deductions.length > 0)
    .filter((l, i, arr) => arr.findIndex((x) => x.ingredientId === l.ingredientId) === i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ChefHatIcon className="size-4" /> I made this
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>I made this</DialogTitle>
          <DialogDescription>
            Confirm how many servings you made — this deducts the ingredients from your inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="servingsMade">Servings made</Label>
          <Input
            id="servingsMade"
            type="number"
            min={0}
            step="0.5"
            value={servingsMade}
            onChange={(e) => setServingsMade(e.target.value)}
            className="w-28"
          />
        </div>

        <div className="max-h-64 overflow-auto rounded-lg border">
          {shown.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">Nothing to deduct.</p>
          ) : (
            <ul className="divide-y text-sm">
              {shown.map((line) => (
                <li key={line.ingredientId} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="font-medium">{line.name}</span>
                  <PreviewStatus line={line} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {plan.warnings.length > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            {plan.warnings.length} warning{plan.warnings.length === 1 ? "" : "s"} — see flags above.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button onClick={confirm} disabled={pending || !(made > 0)}>
            {pending ? "Logging…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewStatus({ line }: { line: CookLine }) {
  const deductStr = line.deductions
    .map((d) => formatQuantityText({ amount: d.amount, amountMax: null, unit: d.unit, raw: null }))
    .join(" + ");

  if (line.status === "ok") {
    return <span className="tabular-nums text-muted-foreground">−{deductStr}</span>;
  }
  if (line.status === "partial") {
    return (
      <span className="flex items-center gap-2">
        <span className="tabular-nums text-muted-foreground">−{deductStr}</span>
        <Badge className="bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-950 dark:text-amber-300">ran low</Badge>
      </span>
    );
  }
  if (line.status === "missing") {
    return <Badge variant="destructive" className="text-[10px]">not in stock</Badge>;
  }
  if (line.status === "unconvertible") {
    return <Badge variant="destructive" className="text-[10px]">unit mismatch</Badge>;
  }
  return <span className="text-xs text-muted-foreground">not tracked</span>;
}
