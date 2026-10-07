import { cn } from "@fin/lib/cn";
import { formatMoney, moneyParts, type MoneyLike } from "@fin/lib/money";

interface MoneyTextProps {
  value: MoneyLike;
  /** hero/kpi: R$ e centavos menores (anatomia do DS §3) · table/inline: valor uniforme. */
  variant?: "hero" | "kpi" | "table" | "inline";
  sign?: "auto" | "always" | "never";
  /** positive: pinta entradas de verde quando o sinal é exibido. */
  tone?: "default" | "positive" | "muted" | "critical";
  compact?: boolean;
  className?: string;
}

const toneClass = {
  default: "",
  positive: "text-positive",
  muted: "text-ink-2",
  critical: "text-critical",
} as const;

/** Valor monetário no padrão brasileiro. Respeita o modo discreto (classe money-value). */
export function MoneyText({
  value,
  variant = "inline",
  sign = "auto",
  tone = "default",
  compact = false,
  className,
}: MoneyTextProps) {
  const label = formatMoney(value, { sign, compact });

  if (variant === "hero" || variant === "kpi") {
    const p = moneyParts(value, { sign });
    return (
      <span
        className={cn(
          "money-value inline-flex items-baseline whitespace-nowrap",
          variant === "hero" ? "figure-hero" : "figure-kpi",
          toneClass[tone],
          className,
        )}
        role="img"
        aria-label={label}
      >
        <span aria-hidden className="contents">
          <span className="mr-[0.18em] self-start pt-[0.16em] text-[0.5em] leading-none font-medium text-ink-2">
            {p.currency}
          </span>
          {p.sign ? <span>{p.sign}</span> : null}
          <span>{p.integer}</span>
          <span className="text-[0.6em] font-medium text-ink-2">,{p.cents}</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "money-value whitespace-nowrap",
        variant === "table" && "nums",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
