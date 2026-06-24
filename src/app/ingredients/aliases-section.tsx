"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { addAliasAction, removeAliasAction } from "./actions";
import type { IngredientAlias } from "@/lib/db/schema";

export function AliasesSection({
  ingredientId,
  initialAliases,
}: {
  ingredientId: number;
  initialAliases: IngredientAlias[];
}) {
  const [aliases, setAliases] = React.useState<IngredientAlias[]>(initialAliases);
  const [input, setInput] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await addAliasAction(ingredientId, trimmed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Optimistically append a temporary row; the page revalidates in the
      // background and replaces it with the persisted alias (real id + publicId).
      setAliases((prev) => [
        ...prev,
        { id: Date.now(), publicId: `tmp-${Date.now()}`, ingredientId, alias: trimmed },
      ]);
      setInput("");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(alias: IngredientAlias) {
    await removeAliasAction(alias.id);
    setAliases((prev) => prev.filter((a) => a.id !== alias.id));
  }

  return (
    <div className="space-y-3">
      {aliases.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {aliases.map((a) => (
            <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
              {a.alias}
              <button
                type="button"
                aria-label={`Remove alias "${a.alias}"`}
                onClick={() => void handleRemove(a)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No aliases yet.</p>
      )}

      <form onSubmit={(e) => void handleAdd(e)} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Eggs, Black Pepper…"
          className="h-8 text-sm"
          disabled={adding}
        />
        <Button type="submit" size="sm" variant="outline" disabled={adding || !input.trim()}>
          {adding ? "Adding…" : "Add"}
        </Button>
      </form>
    </div>
  );
}
