"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { helpTopics, type HelpTopicId } from "@/lib/help";
import { HelpBlocks } from "./help-blocks";

/**
 * The popup opened from a page's ⋯ menu → Help. Shows the topic's short
 * summary (the same text the `/settings/guide` page renders) followed by its
 * full reference detail. The overlay, blur, outside-click, and Escape-to-close
 * all come from <Dialog> (see components/ui/dialog.tsx) — nothing custom here.
 */
export function HelpDialog({
  topicId,
  open,
  onOpenChange,
}: {
  topicId: HelpTopicId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const topic = helpTopics[topicId];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{topic.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          {topic.summary.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
        <HelpBlocks blocks={topic.detail} />
        <DialogFooter showCloseButton>
          <Link
            href="/settings/guide"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline sm:mr-auto"
          >
            Open the full guide →
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
