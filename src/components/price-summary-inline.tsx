import { formatMoney, pricePerDisplayUnit } from "@/lib/domain/format";
import type { PriceSummary } from "@/lib/domain/cost";

export function PriceSummaryInline({
  summary,
  currency,
}: {
  summary: PriceSummary;
  currency: string;
}) {
  if (summary.count === 0 || summary.average == null) {
    return <span className="text-xs text-muted-foreground">no price data</span>;
  }

  const unitLabel = pricePerDisplayUnit(summary.average, summary.defaultUnit).unitLabel;
  const money = (v: number) => formatMoney(pricePerDisplayUnit(v, summary.defaultUnit).value, currency);

  // A single data point → no misleading range.
  if (summary.count === 1 || summary.min === summary.max) {
    return (
      <span className="text-xs text-muted-foreground">
        {money(summary.average)}/{unitLabel}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground">
      {money(summary.min!)}–{money(summary.max!)}/{unitLabel} · avg {money(summary.average)}/{unitLabel}
    </span>
  );
}
