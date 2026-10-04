import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GUIDE_TOPIC_ORDER, helpTopics } from "@/lib/help";

// Static page — renders the guide content array; no DB access.
export const metadata: Metadata = {
  title: "Guide · Pantry",
};

export default function GuidePage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="font-heading text-2xl font-semibold">How to use Pantry</h1>
        <p className="text-sm text-muted-foreground">
         Here is a quick guide to help you get started with Pantry. Each section below gives a brief look at the different features of the app. To get more details about a certain page, press the Help button in that page's menu.
        </p>
      </div>

      <div className="space-y-3">
        {GUIDE_TOPIC_ORDER.map((id, index) => {
          const topic = helpTopics[id];
          return (
            <Card key={topic.id} id={topic.id} className="gap-0 py-0">
              <Collapsible defaultOpen={index === 0}>
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between gap-3 p-4 text-left"
                    />
                  }
                >
                  <span className="font-heading text-base leading-snug font-medium">
                    {topic.title}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 px-4 pb-4 text-sm text-muted-foreground">
                    {topic.summary.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                    {topic.href && (
                      <Link
                        href={topic.href}
                        className="inline-block font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Go to {topic.title} →
                      </Link>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
