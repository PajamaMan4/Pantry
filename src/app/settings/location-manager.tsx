"use client";

import * as React from "react";
import { toast } from "sonner";
import { PencilIcon, TrashIcon, PlusIcon, CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createLocationAction, renameLocationAction, deleteLocationAction } from "./actions";

type Loc = { id: number; name: string };

export function LocationManager({ locations }: { locations: Loc[] }) {
  const [adding, setAdding] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    const name = adding.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createLocationAction({ name });
      if (res.ok) {
        setAdding("");
        toast.success("Location added");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No storage locations yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border px-3">
          {locations.map((l) => (
            <LocationRow key={l.id} location={l} />
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add a location (e.g. Garage freezer)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="outline" onClick={add} disabled={pending || !adding.trim()}>
          <PlusIcon className="size-4" /> Add
        </Button>
      </div>
    </div>
  );
}

function LocationRow({ location }: { location: Loc }) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(location.name);
  const [pending, startTransition] = React.useTransition();

  function save() {
    const next = name.trim();
    if (!next) return;
    startTransition(async () => {
      const res = await renameLocationAction(location.id, { name: next });
      if (res.ok) {
        setEditing(false);
        toast.success("Renamed");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2">
      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8" autoFocus />
          <Button size="icon" variant="ghost" aria-label="Save" onClick={save} disabled={pending}>
            <CheckIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Cancel"
            onClick={() => {
              setName(location.name);
              setEditing(false);
            }}
            disabled={pending}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ) : (
        <>
          <span className="text-sm">{location.name}</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => setEditing(true)}>
              <PencilIcon className="size-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger render={<Button size="icon" variant="ghost" aria-label="Delete" />}>
                <TrashIcon className="size-4" />
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{location.name}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Any inventory stored here will be kept but moved to “Unsorted” (the location is
                    disassociated, not the stock).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={pending}
                    onClick={() => startTransition(async () => void (await deleteLocationAction(location.id)))}
                  >
                    {pending ? "Deleting…" : "Delete location"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </li>
  );
}
