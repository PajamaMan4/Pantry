"use client";

import * as React from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { importPantryFileAction } from "./actions";

export function PantryFileImport() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      startTransition(async () => {
        let json: unknown;
        try {
          json = JSON.parse(evt.target?.result as string);
        } catch {
          setError("Could not parse file — make sure it's a valid .pantry file.");
          return;
        }
        const result = await importPantryFileAction(json);
        // On success the action redirects (throws), so we only reach here on failure.
        if (result && !result.ok) setError(result.error);
      });
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
    // Reset so the same file can be re-selected after an error.
    e.target.value = "";
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pantry,application/json"
        className="hidden"
        onChange={onFileChange}
        disabled={pending}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          <UploadIcon className="size-4" />
          {pending ? "Importing…" : "Choose .pantry file"}
        </Button>
        <a
          href="/api/schema/pantry"
          download="pantry-file.ts"
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}
        >
          <DownloadIcon className="size-4" />
          Export .pantry JSON schema
        </a>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
