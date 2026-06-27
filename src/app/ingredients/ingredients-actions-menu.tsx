"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontalIcon, PackageMinusIcon, PackagePlusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function IngredientsActionsMenu() {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" aria-label="More actions">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push("/ingredients/new")}>
          <PlusIcon className="size-4" /> New ingredient
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/ingredients/inventory/add")}>
          <PackagePlusIcon className="size-4" /> Add inventory
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/ingredients/inventory/remove")}>
          <PackageMinusIcon className="size-4" /> Remove inventory
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
