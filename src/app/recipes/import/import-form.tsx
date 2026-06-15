"use client";

import * as React from "react";
import Link from "next/link";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buttonVariants } from "@/components/ui/button";
import { importRecipeAction } from "./actions";

export function ImportForm({ hasKey }: { hasKey: boolean }) {
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [needsKey, setNeedsKey] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsKey(false);
    startTransition(async () => {
      // On success the action redirects (throws), so we only get here on failure.
      const result = await importRecipeAction(text);
      setError(result.error);
      setNeedsKey(Boolean(result.needsKey));
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Paste a full recipe here — title, ingredients, and steps. Claude will turn it into a structured draft you can review and edit."
        className="min-h-64 font-mono text-sm"
        disabled={pending}
      />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
          {needsKey && (
            <>
              {" "}
              <Link href="/settings" className="font-medium underline underline-offset-4">
                Open Settings
              </Link>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || text.trim().length === 0 || !hasKey}>
          <SparklesIcon className="size-4" />
          {pending ? "Importing…" : "Import with Claude"}
        </Button>
        <Link href="/recipes/new" className={buttonVariants({ variant: "outline" })}>
          Enter manually instead
        </Link>
      </div>

      {!hasKey && (
        <p className="text-sm text-muted-foreground">
          Add an Anthropic API key in{" "}
          <Link href="/settings" className="underline underline-offset-4">
            Settings
          </Link>{" "}
          to enable AI import, or enter the recipe manually.
        </p>
      )}
    </form>
  );
}
