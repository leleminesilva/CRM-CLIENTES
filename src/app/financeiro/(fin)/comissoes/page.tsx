import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { CommissionsView } from "@fin/modules/commissions/components/commissions-view";
import { commissionStats, listCommissions } from "@fin/modules/commissions/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Comissões" };

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const [commissions, stats, options] = await Promise.all([
    listCommissions(ctx, ctx.today, { month }),
    commissionStats(ctx, month, ctx.today),
    loadFormOptions(ctx),
  ]);
  return (
    <CommissionsView
      commissions={commissions}
      stats={stats}
      month={month}
      currentMonth={currentMonth}
      accounts={options.accounts}
      today={ctx.today}
    />
  );
}
