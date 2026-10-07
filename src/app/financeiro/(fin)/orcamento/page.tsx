import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { BudgetsView } from "@fin/modules/budgets/components/budgets-view";
import { budgetOverview } from "@fin/modules/budgets/queries";
import { getCategoryTree } from "@fin/modules/categories/queries";

export const metadata: Metadata = { title: "Orçamento" };

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const [data, groups] = await Promise.all([
    budgetOverview(ctx, month),
    getCategoryTree(ctx, { kind: "EXPENSE" }),
  ]);
  return <BudgetsView data={data} groups={groups} month={month} currentMonth={currentMonth} />;
}
