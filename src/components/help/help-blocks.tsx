import type { HelpBlock } from "@/lib/help";

/** Renders the reference detail of a help topic. Pure markup, no client state. */
export function HelpBlocks({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "p":
            return <p key={i}>{block.text}</p>;
          case "h":
            return (
              <h3 key={i} className="font-heading text-sm font-medium text-foreground">
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "fields":
            return (
              <dl key={i} className="space-y-2">
                {block.items.map((field, j) => (
                  <div key={j}>
                    <dt className="font-medium text-foreground">{field.term}</dt>
                    <dd>{field.text}</dd>
                  </div>
                ))}
              </dl>
            );
        }
      })}
    </div>
  );
}
