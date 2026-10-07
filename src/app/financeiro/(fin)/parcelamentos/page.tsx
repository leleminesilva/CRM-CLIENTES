import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { first, type SearchParams } from "@fin/lib/month";
import { InstallmentsView } from "@fin/modules/installments/components/installments-view";
import { futureImpact, listPlans } from "@fin/modules/installments/queries";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Parcelamentos" };

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const showFinished = first((await searchParams).concluidos) === "1";
  const [plans, impact, options] = await Promise.all([
    listPlans(ctx, { includeFinished: showFinished }),
    futureImpact(ctx, ctx.today),
    loadFormOptions(ctx),
  ]);
  return (
    <InstallmentsView
      plans={plans}
      impact={impact}
      options={options}
      today={ctx.today}
      showFinished={showFinished}
    />
  );
}
