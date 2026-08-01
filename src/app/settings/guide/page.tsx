import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { guideSections } from "@/lib/help/guide-content";

// Static page — renders the guide content array; no DB access.
export const metadata: Metadata = {
  title: "Guide · Pantry",
};

export default function GuidePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="font-heading text-2xl font-semibold">How to use Pantry</h1>
        <p className="text-sm text-muted-foreground">
          Please find below explanations for the variety of features available in your Pantry app. The Pantry app was developed due to the desire to know just how much some recipes cost to cook. To do this, the app was developed with two main pillars: recipes and ingredients, and the rest of the functions were developed around these. It also was designed to be lightweight, no nonsense, and self owned. No subscription models, no place to put advertising, no data collection and selling. Just a database of recipes and ingredients and different ways to view them.
        </p>
      </div>

      <div className="space-y-3">
        {guideSections.map((section, index) => (
          <Card key={section.id} className="gap-0 py-0">
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
                  {section.title}
                </span>
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-3 px-4 pb-4 text-sm text-muted-foreground">
                  {section.body.map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                  {section.href && (
                    <Link
                      href={section.href}
                      className="inline-block font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Go to {section.title} →
                    </Link>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>
    </div>
  );
}
