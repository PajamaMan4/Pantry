import Link from "next/link";
import { formatMoney, formatNumber } from "@/lib/domain/format";
import type { RecipeCost } from "@/lib/domain/cost";

export function RecipeCostSummary({
  cost,
  currency,
  baseServings,
  names,
}: {
  cost: RecipeCost;
  currency: string;
  baseServings: number;
  names: Record<number, string>;
}) {
  if (cost.countedCount === 0) return null;

  const hasKnown = cost.knownCount > 0;
  const unknownNames = cost.unknownIngredientIds.map((id) => names[id] ?? "?");

  return (
    <details className="mt-4 rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        {hasKnown ? (
          <>
            <span className="font-medium">≈ {formatMoney(cost.perServing, currency)} / serving</span>
            <span className="text-muted-foreground">
              {" "}
              · {formatMoney(cost.total, currency)} total ({formatNumber(baseServings)} servings)
            </span>
          </>
        ) : (
          <span className="font-medium text-muted-foreground">Cost unknown — no price data</span>
        )}
        {cost.unknownIngredientIds.length > 0 && (
          <span className="text-muted-foreground"> · {cost.unknownIngredientIds.length} unpriced</span>
        )}
      </summary>

      <ul className="mt-3 space-y-1">
        {cost.lines.map((line) => (
          <li key={line.ingredientId} className="flex items-baseline justify-between gap-2">
            <Link href={`/ingredients/${line.ingredientId}`} className="hover:underline">
              {names[line.ingredientId] ?? "Ingredient"}
            </Link>
            {line.cost != null ? (
              <span className="tabular-nums">{formatMoney(line.cost, currency)}</span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {line.reason === "unconvertible" ? "unit mismatch" : "no price"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {unknownNames.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Cost unknown for: {unknownNames.join(", ")} — excluded from the total.
        </p>
      )}
    </details>
  );
}
