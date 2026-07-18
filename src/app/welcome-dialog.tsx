"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markWelcomeSeenAction } from "./settings/actions";

/**
 * First-run welcome. Rendered only when `hasSeenWelcome` is false (see
 * WelcomeGate), so it opens on mount. Either button marks the flag seen — which
 * revalidates the tree so the gate stops rendering it — meaning it never
 * reappears after a dismissal or after opening the guide.
 */
export function WelcomeDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  const [pending, startTransition] = React.useTransition();

  function dismiss() {
    if (pending) return;
    startTransition(async () => {
      await markWelcomeSeenAction();
      setOpen(false);
    });
  }

  function openGuide() {
    if (pending) return;
    startTransition(async () => {
      await markWelcomeSeenAction();
      router.push("/settings/guide");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Welcome to Pantry</DialogTitle>
          <DialogDescription>
            Your local-first kitchen: save recipes, track what&rsquo;s in stock, plan a menu, and
            see what you can cook right now.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          New here? The guide walks through every part of the app in a couple of minutes.
        </p>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={dismiss} disabled={pending}>
            Dismiss
          </Button>
          <Button type="button" onClick={openGuide} disabled={pending}>
            Take a look at the guide
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
