"use client";

import * as React from "react";
import { LayersIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// A collapsed variant group on the recipe list. The tile shows the group name +
// how many matching variants there are; clicking it opens a dialog listing the
// member recipe cards (passed in as `children`, rendered on the server).
export function RecipeGroupCard({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-label={`${name} — ${count} variants`}
        className="cursor-pointer transition-colors hover:border-foreground/30"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-2 font-medium">
              <LayersIcon className="size-4" /> {name}
            </span>
            <Badge variant="secondary">{count} variants</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Recipe group · click to view variants</p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <span className="inline-flex items-center gap-2">
                <LayersIcon className="size-4" /> {name}
              </span>
            </DialogTitle>
            <DialogDescription>{count} variants match your search.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
