import { Badge } from "@/components/ui/badge";
import { expiryStatus, daysUntil } from "@/lib/domain/expiry";

export function ExpiryBadge({ expiry, now }: { expiry: Date | null; now: Date }) {
  const status = expiryStatus(expiry, now);
  if (!expiry || !status) return null;

  if (status === "expired") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        expired
      </Badge>
    );
  }

  const d = daysUntil(expiry, now);
  const label = d === 0 ? "today" : d === 1 ? "1 day" : `${d} days`;

  if (status === "soon") {
    return (
      <Badge className="bg-amber-100 text-amber-800 text-[10px] dark:bg-amber-950 dark:text-amber-300">
        use in {label}
      </Badge>
    );
  }
  return null;
}
