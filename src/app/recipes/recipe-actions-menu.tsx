"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontalIcon, PencilIcon, DownloadIcon, ListPlusIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteRecipeAction } from "./actions";
import { addMissingForRecipeAction } from "@/app/shopping/actions";

export function RecipeActionsMenu({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [addPending, startAddTransition] = React.useTransition();

  function handleExport() {
    const a = document.createElement("a");
    a.href = `/api/recipes/${recipeId}/export`;
    a.download = "";
    a.click();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" aria-label="More actions">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/recipes/${recipeId}/edit`)}>
            <PencilIcon className="size-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <DownloadIcon className="size-4" /> Export
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={addPending}
            onClick={() =>
              startAddTransition(async () => {
                const r = await addMissingForRecipeAction(recipeId);
                toast.success(
                  r.added > 0 ? `Added ${r.added} to shopping list` : "Nothing new to add",
                );
              })
            }
          >
            <ListPlusIcon className="size-4" /> Add missing to list
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <TrashIcon className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the recipe, its ingredients, and tag links. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={() =>
                startDeleteTransition(async () => void (await deleteRecipeAction(recipeId)))
              }
            >
              {deletePending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
