import type { Metadata } from "next";
import { PageHeader } from "@fin/components/shared/page-header";
import { requirePageContext } from "@fin/lib/context";
import {
  addDays,
  addMonthsToKey,
  firstDayOfMonth,
  isISODate,
  lastDayOfMonth,
  monthKeyOf,
} from "@fin/lib/dates";
import { first, type SearchParams } from "@fin/lib/month";
import { CashFlowView } from "@fin/modules/cash-flow/components/cash-flow-view";
import type { Granularity } from "@fin/modules/cash-flow/domain/buckets";
import { cashFlow } from "@fin/modules/cash-flow/queries";

export const metadata: Metadata = { title: "Fluxo de caixa" };

const GRANULARITIES = ["day", "week", "month", "year"] as const;

function defaults(g: Granularity, today: string) {
  const month = monthKeyOf(today);
  switch (g) {
    case "day":
      return { from: addDays(today, -7), to: addDays(today, 23) };
    case "week":
      return { from: addDays(today, -28), to: addDays(today, 84) };
    case "month":
      return {
        from: firstDayOfMonth(addMonthsToKey(month, -2)),
        to: lastDayOfMonth(addMonthsToKey(month, 9)),
      };
    case "year":
      return {
        from: `${Number(today.slice(0, 4)) - 1}-01-01`,
        to: `${Number(today.slice(0, 4)) + 2}-12-31`,
      };
  }
}

const LIMIT_DAYS: Record<Granularity, number> = { day: 190, week: 800, month: 2400, year: 9000 };

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const visao = first(sp.visao);
  const granularity: Granularity = (GRANULARITIES as readonly string[]).includes(visao ?? "")
    ? (visao as Granularity)
    : "month";
  const d = defaults(granularity, ctx.today);
  const de = first(sp.de);
  const ate = first(sp.ate);
  let from = de && isISODate(de) ? de : d.from;
  let to = ate && isISODate(ate) ? ate : d.to;
  if (to < from) [from, to] = [to, from];
  // Limita o tamanho da janela por granularidade (evita milhares de linhas).
  const maxTo = addDays(from, LIMIT_DAYS[granularity]);
  if (to > maxTo) to = maxTo;

  const { buckets } = await cashFlow(ctx, { from, to, granularity }, ctx.today);
  const dto = buckets.map((b) => ({
    key: b.key,
    start: b.start,
    end: b.end,
    opening: b.opening.toFixed(2),
    income: b.income.toFixed(2),
    expense: b.expense.toFixed(2),
    applications: b.applications.toFixed(2),
    adjustments: b.adjustments.toFixed(2),
    net: b.net.toFixed(2),
    closing: b.closing.toFixed(2),
    projected: b.projected,
    partial: b.partial,
  }));
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fluxo de caixa"
        description="Saldo inicial + entradas − saídas = saldo final, do que já aconteceu ao que está previsto."
      />
      <CashFlowView buckets={dto} granularity={granularity} from={from} to={to} />
    </div>
  );
}
