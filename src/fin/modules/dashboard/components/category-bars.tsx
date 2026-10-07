import { CategoryIconChip } from "@fin/components/shared/category-chip";
import { MoneyText } from "@fin/components/shared/money-text";
import { formatPercent } from "@fin/lib/money";
import type { CategorySpend } from "../queries";

/**
 * "Para onde foi o dinheiro": barras horizontais numa cor só, ordenadas (DS §2.2: categorias não
 * ganham 26 cores; comparar comprimentos é mais preciso que fatias). A cor fica só no ícone.
 */
export function CategoryBars({ items, limit = 7 }: { items: CategorySpend[]; limit?: number }) {
  if (items.length === 0)
    return <p className="py-6 text-center text-[13px] text-ink-3">Nenhuma despesa neste mês.</p>;
  const top = items.slice(0, limit);
  const max = Number.parseFloat(top[0]?.amount ?? "1") || 1;
  return (
    <ul className="grid gap-3">
      {top.map((c) => (
        <li key={c.categoryId} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
          <CategoryIconChip icon={c.icon} color={c.color} size="sm" />
          <div className="grid gap-1">
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-ink-2">
                <MoneyText value={c.amount} variant="table" className="font-medium text-ink" />{" "}
                <span className="text-xs nums">{formatPercent(c.share)}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-sunken" aria-hidden>
              <div
                className="h-full rounded-full bg-series-expense"
                style={{ width: `${Math.min(100, (Number.parseFloat(c.amount) / max) * 100)}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
