import { addMonthsToKey, formatMonth, type ISODate, monthKeyOf } from "@fin/lib/dates";
import { formatMoney, formatPercent, sumMoney, toMoney } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { spendingByCategory } from "@fin/modules/dashboard/queries";
import { forecast } from "@fin/modules/forecast/queries";
import { averageMonthlyCost } from "@fin/modules/goals/queries";
import { fixedExpensesSummary, incomeByClass } from "@fin/modules/transactions/queries";
import type { Insight, InsightProvider } from "./types";

/** Insights por regras (R-insights): cada regra devolve 0 ou 1 frase com o número que a sustenta. */
export const ruleInsightProvider: InsightProvider = {
  name: "rules",
  async generate(ctx: ServiceContext, today: ISODate): Promise<Insight[]> {
    const month = monthKeyOf(today);
    const previous = addMonthsToKey(month, -1);
    const insights: Insight[] = [];

    // 1) Categoria que mais cresceu.
    const [now, before] = await Promise.all([
      spendingByCategory(ctx, month),
      spendingByCategory(ctx, previous),
    ]);
    const grown = now
      .map((c) => {
        const prev = before.find((b) => b.categoryId === c.categoryId);
        return prev && toMoney(prev.amount).greaterThan(0)
          ? {
              c,
              growth: toMoney(c.amount).minus(prev.amount).dividedBy(prev.amount),
              delta: toMoney(c.amount).minus(prev.amount),
            }
          : null;
      })
      .filter(
        (x): x is NonNullable<typeof x> =>
          x !== null && x.growth.greaterThanOrEqualTo(0.25) && x.delta.greaterThanOrEqualTo(100),
      )
      .sort((a, b) => b.growth.comparedTo(a.growth))[0];
    if (grown) {
      insights.push({
        id: `growth:${grown.c.categoryId}:${month}`,
        tone: "warning",
        text: `Você gastou ${formatPercent(grown.growth)} mais com ${grown.c.name.toLowerCase()} em ${formatMonth(month)} do que em ${formatMonth(previous)} (${formatMoney(grown.delta, { sign: "always" })}).`,
        href: `/financeiro/lancamentos?mes=${month}&categoria=${grown.c.categoryId}`,
      });
    }

    // 2) Peso das despesas fixas sobre a renda base.
    const fixed = await fixedExpensesSummary(ctx, month);
    if (fixed.shareOfBase) {
      insights.push({
        id: `fixed-share:${month}`,
        tone: toMoney(fixed.shareOfBase).greaterThan(0.6) ? "warning" : "neutral",
        text: `As despesas fixas representam ${formatPercent(fixed.shareOfBase)} da receita principal.`,
        href: "/financeiro/despesas?aba=fixas",
      });
    }

    // 3) Média mensal dos últimos 6 meses.
    const cost = await averageMonthlyCost(ctx, today);
    if (cost.months >= 2) {
      insights.push({
        id: `avg-cost:${month}`,
        tone: "neutral",
        text: `Seu gasto médio mensal nos últimos ${cost.months} meses é ${formatMoney(cost.average)}.`,
        href: "/financeiro/relatorios/despesa-mensal",
      });
    }

    // 4) Participação das comissões na renda (3 meses completos).
    const months = [1, 2, 3].map((i) => addMonthsToKey(month, -i));
    const classes = await Promise.all(months.map((m) => incomeByClass(ctx, m)));
    const total = sumMoney(classes.flat().map((c) => c.total));
    const commission = sumMoney(
      classes
        .flat()
        .filter((c) => c.incomeClass === "COMMISSION")
        .map((c) => c.total),
    );
    if (total.greaterThan(0) && commission.greaterThan(0)) {
      insights.push({
        id: `commission-share:${month}`,
        tone: "neutral",
        text: `As comissões representam ${formatPercent(commission.dividedBy(total))} da receita total nos últimos 3 meses.`,
        href: "/financeiro/comissoes",
      });
    }

    // 5) Ritmo atual: saldo projetado ao fim do mês.
    const f = await forecast(ctx, today, 3, "realistic");
    const end = f.months[0];
    if (end) {
      insights.push({
        id: `run-rate:${month}`,
        tone: end.negative ? "warning" : "positive",
        text: `Se mantiver seu ritmo atual, você encerrará ${formatMonth(month)} com aproximadamente ${formatMoney(end.closing)} disponíveis.`,
        href: "/financeiro/previsao",
      });
    }
    return insights;
  },
};

export async function getInsights(
  ctx: ServiceContext,
  today: ISODate,
  providers: InsightProvider[] = [ruleInsightProvider],
): Promise<Insight[]> {
  const results = await Promise.allSettled(providers.map((p) => p.generate(ctx, today)));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
