import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { ChequesView } from "@fin/modules/cheques/components/cheques-view";
import { listCheques } from "@fin/modules/cheques/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Cheques" };

export default async function ChequesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const [{ cheques, stats }, options] = await Promise.all([
    listCheques(ctx, ctx.today, month),
    loadFormOptions(ctx),
  ]);
  return (
    <ChequesView
      cheques={cheques}
      stats={stats}
      month={month}
      currentMonth={currentMonth}
      accounts={options.accounts}
      today={ctx.today}
    />
  );
}
