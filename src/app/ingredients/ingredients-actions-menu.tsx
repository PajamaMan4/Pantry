"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontalIcon,
  PackageMinusIcon,
  PackagePlusIcon,
  PencilIcon,
  PlusIcon,
  RulerIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UNIT_SYSTEM_OPTIONS } from "@/components/unit-system-toggle";
import type { DisplaySystem } from "@/lib/domain/scaling";

export function IngredientsActionsMenu({ system }: { system: DisplaySystem }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /** Display units live in the `units` query param so the server render picks them up. */
  function setSystem(value: DisplaySystem) {
    const next = new URLSearchParams(params.toString());
    next.set("units", value);
    router.push(`${pathname}?${next.toString()}`);
  }

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
        <DropdownMenuItem onClick={() => router.push("/ingredients/inventory/edit")}>
          <PencilIcon className="size-4" /> Inventory Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <RulerIcon className="size-4" /> Units
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={system}
              onValueChange={(v) => setSystem(v as DisplaySystem)}
            >
              {UNIT_SYSTEM_OPTIONS.map((o) => (
                <DropdownMenuRadioItem key={o.value} value={o.value}>
                  {o.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
