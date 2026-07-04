"use client";

import * as React from "react";
import { toast } from "sonner";
import { ListPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMissingForMenuAction } from "@/app/shopping/actions";

export function AddMissingForMenuButton() {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await addMissingForMenuAction();
          toast.success(r.added > 0 ? `Added ${r.added} to shopping list` : "Nothing new to add");
        })
      }
    >
      <ListPlusIcon className="size-4" /> Add missing ingredients
    </Button>
  );
}
