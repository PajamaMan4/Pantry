"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { deletePriceEntryAction } from "./actions";

export function DeletePriceButton({ id }: { id: number }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <button
      type="button"
      aria-label="Delete price entry"
      disabled={pending}
      onClick={() => startTransition(async () => void (await deletePriceEntryAction(id)))}
      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      <XIcon className="size-3.5" />
    </button>
  );
}
