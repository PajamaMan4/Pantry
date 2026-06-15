"use client";

import * as React from "react";
import { toast } from "sonner";
import { ListPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMissingForRecipeAction } from "@/app/shopping/actions";

export function AddMissingButton({ recipeId }: { recipeId: number }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await addMissingForRecipeAction(recipeId);
          toast.success(r.added > 0 ? `Added ${r.added} to shopping list` : "Nothing new to add");
        })
      }
    >
      <ListPlusIcon className="size-4" /> Add missing to list
    </Button>
  );
}
