import type { Metadata } from "next";
import { PageHeader } from "@fin/components/shared/page-header";
import { requirePageContext } from "@fin/lib/context";
import { first, type SearchParams } from "@fin/lib/month";
import type { Scenario } from "@fin/modules/forecast/domain/project";
import { ForecastView } from "@fin/modules/forecast/components/forecast-view";
import { forecast } from "@fin/modules/forecast/queries";

export const metadata: Metadata = { title: "Previsão" };

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  const meses = Number(first(sp.meses));
  const horizon = (meses === 3 || meses === 12 ? meses : 6) as 3 | 6 | 12;
  const c = first(sp.cenario);
  const scenario: Scenario = c === "conservative" || c === "optimistic" ? c : "realistic";
  const data = await forecast(ctx, ctx.today, horizon, scenario);
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Previsão"
        description="Renda base, comissões típicas, despesas fixas, parcelas e faturas projetadas para os próximos meses — e em quais o caixa aperta."
      />
      <ForecastView data={data} horizon={horizon} />
    </div>
  );
}
