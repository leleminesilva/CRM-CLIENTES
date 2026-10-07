import type { Metadata } from "next";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { PageHeader } from "@fin/components/shared/page-header";
import { requirePageContext } from "@fin/lib/context";
import { toMoneyString, sumMoney } from "@fin/lib/money";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { RecurrenceList } from "@fin/modules/recurrences/components/recurrence-list";
import { listRecurrences } from "@fin/modules/recurrences/queries";
import { IncomeActions } from "@fin/modules/transactions/components/income-actions";
import { IncomeClassCards } from "@fin/modules/transactions/components/income-class-cards";
import { TransactionFilters } from "@fin/modules/transactions/components/transaction-filters";
import { TransactionList } from "@fin/modules/transactions/components/transaction-list";
import { parseFilters } from "@fin/modules/transactions/filters";
import { incomeByClass, listTransactions, loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Minha renda" };

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const { month, currentMonth } = resolveMonth(sp.mes, ctx.today);
  const [transactions, classes, series, options] = await Promise.all([
    listTransactions(ctx, parseFilters(month, sp, { type: "INCOME" }), ctx.today),
    incomeByClass(ctx, month),
    listRecurrences(ctx, { type: "INCOME" }, ctx.today),
    loadFormOptions(ctx),
  ]);
  const total = toMoneyString(sumMoney(classes.map((c) => c.total)));
  const base =
    options.categories.income.find((c) => c.incomeClass === "BASE" && !c.isSystem)?.id ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Minha renda"
        description="Salário base, comissões e rendas extras do mês, pelo mês da previsão de recebimento."
        actions={
          <>
            <MonthSwitcher month={month} currentMonth={currentMonth} />
            <IncomeActions baseCategoryId={base} />
          </>
        }
      />
      <IncomeClassCards classes={classes} total={total} />
      <TransactionFilters options={options} hideType />
      <TransactionList
        transactions={transactions}
        today={ctx.today}
        accounts={options.accounts}
        emptyType="INCOME"
        emptyTitle="Nenhuma receita neste mês"
        emptyDescription="Cadastre sua renda base (ela se repete todo mês) e vá adicionando comissões e rendas extras."
      />
      <RecurrenceList
        items={series}
        title="Receitas que se repetem"
        description="Geram os próximos 12 meses automaticamente. Editar um mês específico não altera os outros."
      />
    </div>
  );
}
