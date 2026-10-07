import type { Metadata } from "next";
import Link from "next/link";
import { ChartLegend, IncomeExpenseChart } from "@fin/components/charts/income-expense-chart";
import { ChartFrame, ChartTable } from "@fin/components/charts/chart-frame";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { requirePageContext } from "@fin/lib/context";
import { addMonthsToKey, formatMonth } from "@fin/lib/dates";
import { formatMoney, formatPercent, ratio, toMoney } from "@fin/lib/money";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { listAccounts } from "@fin/modules/accounts/queries";
import { AlertItem } from "@fin/modules/alerts/components/alert-item";
import { pendingClosingMonth } from "@fin/modules/closing/queries";
import { InsightsList } from "@fin/modules/insights/components/insights-list";
import { getInsights } from "@fin/modules/insights/rules";
import { listAlerts } from "@fin/modules/alerts/queries";
import { refreshAlerts } from "@fin/modules/alerts/service";
import { CategoryBars } from "@fin/modules/dashboard/components/category-bars";
import { KpiCard } from "@fin/modules/dashboard/components/kpi-card";
import { MonthRuler } from "@fin/modules/dashboard/components/month-ruler";
import { UpcomingPayments } from "@fin/modules/dashboard/components/upcoming-payments";
import { monthlySeries, spendingByCategory, upcomingPayments } from "@fin/modules/dashboard/queries";
import { OnboardingChecklist } from "@fin/modules/onboarding/components/onboarding-checklist";
import { onboardingState } from "@fin/modules/onboarding/queries";
import { incomeByClass, loadFormOptions, monthTotals } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Painel" };

const CLASS_LABELS = {
  BASE: "Base",
  COMMISSION: "Comissões",
  EXTRA: "Renda extra",
  OTHER: "Outros",
} as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  await refreshAlerts(ctx, ctx.today);
  const [
    accounts,
    totals,
    previous,
    classes,
    series,
    categories,
    upcoming,
    alerts,
    onboarding,
    options,
    insights,
    closingMonth,
  ] = await Promise.all([
    listAccounts(ctx),
    monthTotals(ctx, month, ctx.today),
    monthTotals(ctx, addMonthsToKey(month, -1), ctx.today),
    incomeByClass(ctx, month),
    monthlySeries(ctx, month),
    spendingByCategory(ctx, month),
    upcomingPayments(ctx, ctx.today, 30),
    listAlerts(ctx, { limit: 4 }),
    onboardingState(ctx),
    loadFormOptions(ctx),
    getInsights(ctx, ctx.today),
    pendingClosingMonth(ctx, ctx.today),
  ]);

  const resultDelta = ratio(
    toMoney(totals.result).minus(toMoney(previous.result)),
    toMoney(previous.result).abs(),
  );
  const pendingCount = upcoming.filter((u) => u.dueDate.slice(0, 7) <= month).length;
  // Só meses completos e com movimento: mês vazio não é "o melhor", e o mês em curso ainda não fechou.
  const closedMonths = series.filter(
    (p) => p.month < currentMonth && (p.income !== "0.00" || p.expense !== "0.00"),
  );
  const best = closedMonths.reduce<(typeof series)[number] | null>(
    (b, p) => (!b || toMoney(p.result).greaterThan(toMoney(b.result)) ? p : b),
    null,
  );
  const negativeMonths = closedMonths.filter((p) => toMoney(p.result).isNegative()).length;
  const partial =
    month === currentMonth
      ? ` ${formatMonth(month)} está em ${formatMoney(totals.result, { sign: "always" })} até agora.`
      : "";
  const chartAnswer = !best
    ? `Ainda não há um mês completo com lançamentos para comparar.${partial}`
    : negativeMonths === 0
      ? `Sim, nos ${closedMonths.length} ${closedMonths.length === 1 ? "mês completo" : "meses completos"} com lançamentos. O melhor foi ${formatMonth(best.month)} (${formatMoney(best.result, { sign: "always" })}).${partial}`
      : `${negativeMonths} de ${closedMonths.length} ${closedMonths.length === 1 ? "mês completo fechou" : "meses completos fecharam"} no vermelho. O melhor foi ${formatMonth(best.month)} (${formatMoney(best.result, { sign: "always" })}).${partial}`;
  const baseCategory = options.categories.income.find((c) => c.incomeClass === "BASE")?.id ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Painel"
        description="O mês inteiro em uma tela: quanto você tem, quanto entra, quanto sai e o que vence."
        actions={<MonthSwitcher month={month} currentMonth={currentMonth} />}
      />

      {closingMonth ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">
            <strong>{formatMonth(closingMonth)}</strong> terminou. Que tal conferir e fechar o mês?
          </p>
          <Link
            href="/financeiro/fechamento"
            className="text-[13px] font-medium underline underline-offset-4 hover:no-underline"
          >
            Fazer o fechamento
          </Link>
        </Panel>
      ) : null}

      {onboarding.visible ? (
        <OnboardingChecklist steps={onboarding.steps} baseCategoryId={baseCategory} />
      ) : null}

      <Panel className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-center">
        <div className="grid gap-1">
          <span className="text-[13px] text-ink-2">Saldo disponível</span>
          <MoneyText
            value={accounts.summary.available}
            variant="hero"
            tone={accounts.summary.available.startsWith("-") ? "critical" : "default"}
          />
          <span className="text-xs text-ink-3">
            Em {accounts.accounts.filter((a) => a.isLiquid).length}{" "}
            {accounts.accounts.filter((a) => a.isLiquid).length === 1 ? "conta" : "contas"} ·{" "}
            <Link href="/financeiro/contas" className="underline-offset-4 hover:underline">
              ver contas
            </Link>
          </span>
          {accounts.summary.beforeStartCount > 0 ? (
            <Link
              href="/financeiro/contas"
              className="mt-1 text-xs text-warning-text underline underline-offset-4 hover:no-underline"
            >
              {accounts.summary.beforeStartCount}{" "}
              {accounts.summary.beforeStartCount === 1
                ? "lançamento anterior ao saldo inicial não entra"
                : "lançamentos anteriores ao saldo inicial não entram"}{" "}
              no saldo. Entenda
            </Link>
          ) : null}
        </div>
        <div className="lg:border-l lg:border-line lg:pl-6">
          <MonthRuler
            incomeTotal={totals.income.total}
            incomeSettled={totals.income.settled}
            expenseTotal={totals.expense.total}
            expenseSettled={totals.expense.settled}
            monthLabel={formatMonth(month)}
          />
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receitas do mês"
          value={totals.income.total}
          lines={classes
            .filter((c) => c.total !== "0.00")
            .map((c) => (
              <span key={c.incomeClass} className="flex justify-between gap-2">
                <span>{CLASS_LABELS[c.incomeClass]}</span>
                <MoneyText value={c.total} variant="table" />
              </span>
            ))}
          href={`/financeiro/receitas${month !== currentMonth ? `?mes=${month}` : ""}`}
          linkLabel="Ver renda"
        />
        <KpiCard
          label="Despesas do mês"
          value={totals.expense.total}
          lines={
            <>
              <span className="flex justify-between gap-2">
                <span>Pago</span>
                <MoneyText value={totals.expense.settled} variant="table" />
              </span>
              <span className="flex justify-between gap-2">
                <span>Pendente</span>
                <MoneyText value={totals.expense.pending} variant="table" />
              </span>
              {totals.expense.overdue !== "0.00" ? (
                <span className="flex justify-between gap-2 text-critical">
                  <span>Vencido</span>
                  <MoneyText value={totals.expense.overdue} variant="table" />
                </span>
              ) : null}
            </>
          }
          href={`/financeiro/despesas${month !== currentMonth ? `?mes=${month}` : ""}`}
          linkLabel="Ver despesas"
        />
        <KpiCard
          label="Resultado do mês"
          value={totals.result}
          sign="always"
          tone={totals.result.startsWith("-") ? "critical" : "positive"}
          lines={
            <>
              <span>Receitas − despesas previstas</span>
              {resultDelta ? (
                <span>
                  {resultDelta.isNegative() ? "▼" : "▲"} {formatPercent(resultDelta.abs())} vs{" "}
                  {formatMonth(addMonthsToKey(month, -1), "short")}
                </span>
              ) : null}
            </>
          }
        />
        <KpiCard
          label="A pagar no mês"
          value={totals.expense.pending}
          tone={totals.expense.overdue !== "0.00" ? "critical" : "default"}
          lines={
            <span>
              {pendingCount} {pendingCount === 1 ? "conta ou fatura" : "contas e faturas"} até o fim
              do mês
            </span>
          }
          href="/financeiro/calendario"
          linkLabel="Ver no calendário"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ChartFrame
          question="Sobrou dinheiro nos últimos 12 meses?"
          answer={chartAnswer}
          chart={
            <div className="grid gap-3">
              <ChartLegend
                items={[
                  { label: "Receitas", color: "var(--series-income)" },
                  { label: "Despesas", color: "var(--series-expense)" },
                  { label: "Resultado", color: "var(--ink)", line: true },
                ]}
              />
              <IncomeExpenseChart
                data={series.map((p) => ({
                  month: p.month,
                  income: Number(p.income),
                  expense: Number(p.expense),
                  result: Number(p.result),
                }))}
              />
            </div>
          }
          table={
            <ChartTable
              head={["Mês", "Receitas", "Despesas", "Resultado"]}
              rows={series.map((p) => [
                formatMonth(p.month),
                formatMoney(p.income),
                formatMoney(p.expense),
                formatMoney(p.result, { sign: "always" }),
              ])}
            />
          }
          footnote="Pelo mês de vencimento; compras no cartão contam no mês da fatura. Transferências e pagamentos de fatura não entram."
        />
        <UpcomingPayments items={upcoming} today={ctx.today} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Para onde foi o dinheiro"
            description={`Despesas de ${formatMonth(month)} por categoria`}
          />
          <div className="p-5">
            <CategoryBars items={categories} />
          </div>
        </Panel>
        <Panel className="flex flex-col">
          <PanelHeader
            title="Alertas"
            actions={
              <Link
                href="/financeiro/alertas"
                className="text-xs font-medium text-ink-2 hover:text-ink hover:underline"
              >
                Ver todos
              </Link>
            }
          />
          {alerts.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">
              Tudo em dia. Nenhum alerta agora.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {alerts.map((a) => (
                <li key={a.id}>
                  <AlertItem alert={a} compact />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Insights" description="O que os seus números dizem hoje" />
        <div className="mt-2">
          <InsightsList insights={insights} />
        </div>
      </Panel>
    </div>
  );
}
