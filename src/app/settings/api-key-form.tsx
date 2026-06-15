"use client";

import * as React from "react";
import { saveApiKeyAction, type SaveApiKeyResult } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ApiKeyForm({ hasKey }: { hasKey: boolean }) {
  const [state, formAction, pending] = React.useActionState<SaveApiKeyResult | null, FormData>(
    saveApiKeyAction,
    null,
  );
  // After a save, prefer the server's notion of whether a key is stored.
  const keyStored = state?.ok ? state.hasKey : hasKey;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="anthropicApiKey">Anthropic API key</Label>
        <Input
          id="anthropicApiKey"
          name="anthropicApiKey"
          type="password"
          autoComplete="off"
          placeholder={keyStored ? "•••••••••• (saved)" : "sk-ant-…"}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {keyStored
            ? "A key is saved. Type a new key to replace it, or clear the field and save to remove it."
            : "Stored locally in your database. Leave blank to keep using the ANTHROPIC_API_KEY environment variable, if set."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save key"}
        </Button>
        {state?.ok && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
        {state && !state.ok && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
