import type { Metadata } from "next";
import Link from "next/link";
import { MonthSwitcher } from "@fin/components/shared/month-switcher";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel, PanelHeader } from "@fin/components/shared/panel";
import { requirePageContext } from "@fin/lib/context";
import { addMonthsToKey, formatMonth, isMonthKey, monthKeyOf } from "@fin/lib/dates";
import { can } from "@fin/lib/permissions";
import type { SearchParams } from "@fin/lib/month";
import { ClosingView } from "@fin/modules/closing/components/closing-view";
import { getClosingReview, listClosings } from "@fin/modules/closing/queries";

export const metadata: Metadata = { title: "Fechamento do mês" };

export default async function ClosingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const sp = await searchParams;
  // O ritual é sobre o mês que acabou: sem ?mes=, abre o mês anterior.
  const defaultMonth = addMonthsToKey(monthKeyOf(ctx.today), -1);
  const param = Array.isArray(sp.mes) ? sp.mes[0] : sp.mes;
  const month = param && isMonthKey(param) ? param : defaultMonth;
  const [review, history] = await Promise.all([
    getClosingReview(ctx, month, ctx.today),
    listClosings(ctx),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Fechamento do mês"
        description="Um ritual curto: confira pendências, veja o resultado e registre o que o mês ensinou."
        actions={<MonthSwitcher month={month} currentMonth={defaultMonth} />}
      />
      <ClosingView review={review} canReopen={can(ctx, "manage")} />
      <Panel>
        <PanelHeader
          title="Meses fechados"
          description="Cada fechamento guarda o resultado e o patrimônio do dia."
        />
        {history.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nenhum mês fechado ainda.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.month}>
                <Link
                  href={`/financeiro/fechamento?mes=${h.month}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-surface-sunken"
                >
                  <span className="text-sm font-medium">{formatMonth(h.month)}</span>
                  <span className="flex items-center gap-6 text-[13px] text-ink-2">
                    <span>
                      Resultado <MoneyText value={h.result} variant="table" sign="always" />
                    </span>
                    <span>
                      Patrimônio <MoneyText value={h.netWorth} variant="table" />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
