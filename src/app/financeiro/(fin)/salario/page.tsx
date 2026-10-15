import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { PayrollView } from "@fin/modules/payroll/components/payroll-view";
import { crmUserOptions, payrollOverview } from "@fin/modules/payroll/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Salário" };

export default async function PayrollPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const [overview, options, users] = await Promise.all([
    payrollOverview(ctx, month, ctx.today),
    loadFormOptions(ctx),
    crmUserOptions(),
  ]);
  return (
    <PayrollView
      overview={overview}
      month={month}
      currentMonth={currentMonth}
      accounts={options.accounts}
      users={users}
      today={ctx.today}
    />
  );
}
