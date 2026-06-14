"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/domain/format";

export type PricePoint = { date: number; price: number };

export function PriceChart({
  points,
  currency,
  unitLabel,
}: {
  points: PricePoint[];
  currency: string;
  unitLabel: string;
}) {
  if (points.length < 2) return null;

  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          type="number"
          scale="time"
          domain={["dataMin", "dataMax"]}
          tickFormatter={fmtDate}
          tick={{ fontSize: 11 }}
          stroke="var(--muted-foreground)"
        />
        <YAxis
          width={64}
          tickFormatter={(v: number) => formatMoney(v, currency)}
          tick={{ fontSize: 11 }}
          stroke="var(--muted-foreground)"
        />
        <Tooltip
          formatter={(v) => [`${formatMoney(Number(v), currency)}/${unitLabel}`, "Price"]}
          labelFormatter={(t) => new Date(Number(t)).toLocaleDateString()}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line type="monotone" dataKey="price" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
