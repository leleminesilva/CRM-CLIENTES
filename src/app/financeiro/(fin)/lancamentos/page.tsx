import type { Metadata } from "next";
import { PageHeader } from "@fin/components/shared/page-header";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { MonthSummary } from "@fin/modules/transactions/components/month-summary";
import { TransactionFilters } from "@fin/modules/transactions/components/transaction-filters";
import { TransactionList } from "@fin/modules/transactions/components/transaction-list";
import { parseFilters } from "@fin/modules/transactions/filters";
import { listTransactions, loadFormOptions, monthTotals } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const { month, currentMonth } = resolveMonth(sp.mes, ctx.today);
  const [transactions, totals, options] = await Promise.all([
    listTransactions(ctx, parseFilters(month, sp), ctx.today),
    monthTotals(ctx, month, ctx.today),
    loadFormOptions(ctx),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Lançamentos"
        description="Tudo o que entra e sai, pelo mês do vencimento. Cartão conta no mês da fatura."
        actions={<MonthSwitcher month={month} currentMonth={currentMonth} />}
      />
      <MonthSummary totals={totals} />
      <TransactionFilters options={options} />
      <TransactionList transactions={transactions} today={ctx.today} accounts={options.accounts} />
    </div>
  );
}
