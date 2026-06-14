"use client";

import * as React from "react";
import { toast } from "sonner";
import { Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { undoCookAction } from "./cook-actions";

export function UndoCookButton({ cookLogId, recipeId }: { cookLogId: number; recipeId: number }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await undoCookAction(cookLogId, recipeId);
          toast.success("Cook undone — inventory restored");
        })
      }
    >
      <Undo2Icon className="size-4" /> Undo
    </Button>
  );
}
