import { MoneyText } from "@fin/components/shared/money-text";
import { cn } from "@fin/lib/cn";
import { formatPercent, ratio } from "@fin/lib/money";

/** Limite usado × disponível. Acima de 90% o trecho usado fica em crítico, com texto (nunca só cor). */
export function LimitMeter({
  limit,
  used,
  available,
}: {
  limit: string;
  used: string;
  available: string;
}) {
  const r = ratio(used, limit);
  const pct = r ? Math.min(100, Math.max(0, r.toNumber() * 100)) : 0;
  const high = pct >= 90;
  return (
    <div className="grid gap-1.5">
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-sunken"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`Limite usado: ${formatPercent(r)}`}
      >
        <div
          className={cn("h-full rounded-full", high ? "bg-status-critical" : "bg-ink")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-xs text-ink-3">
        <span>
          Usado <MoneyText value={used} className="font-medium text-ink-2" /> ({formatPercent(r)})
        </span>
        <span>
          Disponível{" "}
          <MoneyText
            value={available}
            className={cn(
              "font-medium",
              available.startsWith("-") ? "text-critical" : "text-ink-2",
            )}
          />{" "}
          de <MoneyText value={limit} />
        </span>
      </div>
    </div>
  );
}
