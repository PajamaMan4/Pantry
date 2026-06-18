"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DownloadIcon, DatabaseBackupIcon, UploadIcon, RotateCcwIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { backupNowAction, restoreBackupAction } from "./actions";
import type { BackupFile } from "@/lib/db/maintenance";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DataManager({ backups }: { backups: BackupFile[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function onBackup() {
    startTransition(async () => {
      const result = await backupNowAction();
      if (result.ok) {
        toast.success("Backup created", { description: result.name });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRestoreBackup(name: string) {
    startTransition(async () => {
      const result = await restoreBackupAction(name);
      if (result.ok) {
        toast.success("Database restored", { description: `From ${name}` });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function onRestoreUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/data/restore", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        toast.success("Database restored", { description: file.name });
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
      } else {
        toast.error(data.error ?? "Restore failed.");
      }
    } catch {
      toast.error("Couldn't upload the file.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Export</h2>
        <p className="text-sm text-muted-foreground">
          Download a consistent snapshot of the whole database (recipes, inventory, prices,
          settings) as a single <code>.db</code> file.
        </p>
        <a href="/data/export" className={buttonVariants({ variant: "outline" })} download>
          <DownloadIcon className="size-4" /> Download database
        </a>
      </section>

      {/* Backups */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Backups</h2>
          <Button size="sm" variant="outline" onClick={onBackup} disabled={pending}>
            <DatabaseBackupIcon className="size-4" /> Back up now
          </Button>
        </div>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {backups.map((b) => (
              <li key={b.name} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{b.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={`/data/backups/${b.name}`}
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                    download
                  >
                    <DownloadIcon className="size-4" />
                  </a>
                  <RestoreConfirm
                    description={`Replace all current data with the contents of ${b.name}. Your current data is backed up first.`}
                    disabled={pending}
                    onConfirm={() => onRestoreBackup(b.name)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Restore from file */}
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Restore from a file</h2>
        <p className="text-sm text-muted-foreground">
          Replace the current database with an exported <code>.db</code> file. A safety backup is
          taken automatically before anything is overwritten.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={fileRef}
            type="file"
            accept=".db,application/octet-stream,application/vnd.sqlite3,application/x-sqlite3"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="max-w-xs"
            disabled={uploading}
          />
          <RestoreConfirm
            label="Restore"
            description={
              file
                ? `Replace all current data with the contents of ${file.name}. Your current data is backed up first.`
                : "Choose a file first."
            }
            disabled={!file || uploading}
            onConfirm={onRestoreUpload}
          />
        </div>
      </section>
    </div>
  );
}

function RestoreConfirm({
  label,
  description,
  disabled,
  onConfirm,
}: {
  label?: string;
  description: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant={label ? "default" : "ghost"} size="sm" disabled={disabled} />}
      >
        {label ? (
          <>
            <UploadIcon className="size-4" /> {label}
          </>
        ) : (
          <RotateCcwIcon className="size-4" />
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Restore the database?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Restore</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
