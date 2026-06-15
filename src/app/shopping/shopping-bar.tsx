"use client";

import * as React from "react";
import { toast } from "sonner";
import { ShoppingCartIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { receiveCheckedAction, clearCheckedAction } from "./actions";

export function ShoppingBar({ checkedCount }: { checkedCount: number }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={pending || checkedCount === 0}
        onClick={() =>
          startTransition(async () => {
            const r = await receiveCheckedAction();
            toast.success(`Added ${r.added} item${r.added === 1 ? "" : "s"} to inventory`);
          })
        }
      >
        <ShoppingCartIcon className="size-4" /> Add purchased to inventory
      </Button>
      <Button
        variant="ghost"
        disabled={pending || checkedCount === 0}
        onClick={() =>
          startTransition(async () => {
            await clearCheckedAction();
            toast.success("Cleared checked items");
          })
        }
      >
        <Trash2Icon className="size-4" /> Clear checked
      </Button>
    </div>
  );
}
