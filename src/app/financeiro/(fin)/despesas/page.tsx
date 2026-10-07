import type { Metadata } from "next";
import Link from "next/link";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { cn } from "@fin/lib/cn";
import { requirePageContext } from "@fin/lib/context";
import { first, resolveMonth, type SearchParams } from "@fin/lib/month";
import { RecurrenceList } from "@fin/modules/recurrences/components/recurrence-list";
import { listRecurrences } from "@fin/modules/recurrences/queries";
import { FixedExpensesSummaryCards } from "@fin/modules/transactions/components/fixed-expenses-summary";
import { NewExpenseButton } from "@fin/modules/transactions/components/new-expense-button";
import { TransactionFilters } from "@fin/modules/transactions/components/transaction-filters";
import { TransactionList } from "@fin/modules/transactions/components/transaction-list";
import { parseFilters } from "@fin/modules/transactions/filters";
import {
  fixedExpensesSummary,
  listTransactions,
  loadFormOptions,
} from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Despesas" };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const { month, currentMonth } = resolveMonth(sp.mes, ctx.today);
  const fixedTab = first(sp.aba) === "fixas";
  const options = await loadFormOptions(ctx);
  const filters = parseFilters(month, sp, {
    type: "EXPENSE",
    ...(fixedTab ? { nature: "FIXED" as const } : {}),
  });

  const [transactions, summary, series] = await Promise.all([
    listTransactions(ctx, filters, ctx.today),
    fixedTab ? fixedExpensesSummary(ctx, month) : Promise.resolve(null),
    fixedTab
      ? listRecurrences(ctx, { type: "EXPENSE", nature: "FIXED" }, ctx.today)
      : Promise.resolve([]),
  ]);

  const tabHref = (aba: string | null) => {
    const p = new URLSearchParams();
    if (aba) p.set("aba", aba);
    if (month !== currentMonth) p.set("mes", month);
    return p.toString() ? `/financeiro/despesas?${p}` : "/financeiro/despesas";
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Despesas"
        description={
          fixedTab
            ? "O que se repete todo mês e pesa na renda, independente de quanto você gasta no resto."
            : "Contas, compras e gastos do dia a dia, pelo mês do vencimento."
        }
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
            <NewExpenseButton />
          </>
        }
      />
      <nav aria-label="Visões de despesas" className="flex gap-1 border-b border-line">
        {[
          { label: "Todas", href: tabHref(null), active: !fixedTab },
          { label: "Fixas", href: tabHref("fixas"), active: fixedTab },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            scroll={false}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3 text-sm text-ink-2 hover:text-ink",
              t.active && "border-ink font-medium text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {summary ? <FixedExpensesSummaryCards summary={summary} /> : null}
      <TransactionFilters options={options} hideType />
      <TransactionList
        transactions={transactions}
        today={ctx.today}
        accounts={options.accounts}
        emptyType="EXPENSE"
        emptyTitle={fixedTab ? "Nenhuma despesa fixa neste mês" : "Nenhuma despesa neste mês"}
        emptyDescription={
          fixedTab
            ? "Cadastre aluguel, internet, academia… marcando “Repetir”. Elas aparecem aqui e entram na previsão."
            : "Registre uma despesa: valor, descrição, categoria e conta."
        }
      />
      {fixedTab ? (
        <RecurrenceList
          items={series}
          title="Despesas fixas que se repetem"
          description="Cada série gera os próximos 12 meses. Pause ou encerre quando mudar."
        />
      ) : null}
    </div>
  );
}
