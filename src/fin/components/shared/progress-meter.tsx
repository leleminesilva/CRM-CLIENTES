import { MoneyText } from "@fin/components/shared/money-text";
import { cn } from "@fin/lib/cn";
import { formatMoney, toMoney } from "@fin/lib/money";

interface ProgressMeterProps {
  /** Gasto/valor atual. */
  value: string;
  /** Limite/meta. */
  limit: string;
  state?: "ok" | "warning" | "over";
  label: string;
  className?: string;
}

/**
 * Trilho + preenchimento + marca do limite. Acima de 100% o trecho excedente aparece além da marca,
 * em crítico, e o texto traz "R$ 1.150 / R$ 1.000" (DS §7: nunca só cor).
 */
export function ProgressMeter({
  value,
  limit,
  state = "ok",
  label,
  className,
}: ProgressMeterProps) {
  const v = Number.parseFloat(value);
  const l = Number.parseFloat(limit);
  const over = l > 0 ? v > l : v > 0;
  const scale = over ? Math.max(v, l) : l;
  const fill = scale > 0 ? Math.min(100, (Math.min(v, l) / scale) * 100) : 0;
  const mark = scale > 0 ? (l / scale) * 100 : 100;
  const excess = over ? Math.max(0, 100 - mark) : 0;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div
        className="relative h-2.5 rounded-full bg-surface-sunken"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={l}
        aria-valuenow={Math.min(v, l)}
        aria-valuetext={`${formatMoney(value)} de ${formatMoney(limit)}${over ? " (acima do limite)" : ""}`}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            state === "warning" ? "bg-status-warning" : "bg-ink",
          )}
          style={{ width: `${fill}%` }}
        />
        {over ? (
          <div
            className="absolute inset-y-0 rounded-r-full bg-status-critical"
            style={{ left: `${mark}%`, width: `${excess}%` }}
          />
        ) : null}
        {over ? (
          <div
            className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-ink"
            style={{ left: `calc(${mark}% - 1px)` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex justify-between gap-2 text-xs">
        <span className={cn("nums", over ? "font-medium text-critical" : "text-ink-2")}>
          <MoneyText value={value} /> / <MoneyText value={limit} />
        </span>
        <span className={cn("nums", over ? "font-medium text-critical" : "text-ink-3")}>
          {over ? (
            <>
              Passou <MoneyText value={toMoney(value).minus(toMoney(limit))} />
            </>
          ) : (
            <>
              Disponível <MoneyText value={toMoney(limit).minus(toMoney(value))} />
            </>
          )}
        </span>
      </div>
    </div>
  );
}
