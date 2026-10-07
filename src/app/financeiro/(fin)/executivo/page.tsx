import type { Metadata } from "next";
import Link from "next/link";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { requirePageContext } from "@fin/lib/context";
import { formatMonth } from "@fin/lib/dates";
import { formatMoney, formatPercent, ratio, toMoney } from "@fin/lib/money";
import { executiveBrief, type Growth } from "@fin/modules/executive/queries";
import { InsightsList } from "@fin/modules/insights/components/insights-list";

export const metadata: Metadata = { title: "Visão executiva" };

function Row({
  question,
  children,
  context,
  href,
}: {
  question: string;
  children: React.ReactNode;
  context?: React.ReactNode;
  href?: string;
}) {
  return (
    <div className="grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-baseline sm:gap-6">
      <h2 className="text-sm font-medium text-ink-2">
        {href ? (
          <Link href={href} className="hover:text-ink hover:underline">
            {question}
          </Link>
        ) : (
          question
        )}
      </h2>
      <div className="grid gap-0.5">
        {children}
        {context ? <p className="text-[13px] leading-5 text-ink-3">{context}</p> : null}
      </div>
    </div>
  );
}

function Delta({ change }: { change: string | null }) {
  if (change === null) return <span className="figure-kpi text-ink-3">—</span>;
  const n = toMoney(change);
  return (
    <span className="figure-kpi">
      {n.isNegative() ? "▼" : "▲"} {formatPercent(n.abs(), 1)}
    </span>
  );
}

const range = (from: string, to: string) =>
  `${formatMonth(from, "short")}–${formatMonth(to, "short")}`;

function growthText(g: Growth, month: string): string {
  if (!g.comparable)
    return `Ainda não há histórico para comparar: são precisos meses completos com lançamentos antes de ${formatMonth(month)} (o mês em curso não entra).`;
  return `Média mensal de ${range(g.recentFrom, g.recentTo)} (${formatMoney(g.recent)}) contra ${range(g.previousFrom, g.previousTo)} (${formatMoney(g.previous)}). O mês em curso não entra.`;
}

export default async function ExecutivePage() {
  const ctx = await requirePageContext();
  const b = await executiveBrief(ctx, ctx.today);
  const commitment = ratio(b.expenseTotal, toMoney(b.expenseTotal).plus(b.leftover));

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Visão executiva"
        description="Sua situação financeira em 30 segundos: dez perguntas, uma resposta cada."
      />

      <Panel className="divide-y divide-line">
        <Row
          question="Quanto eu tenho?"
          href="/financeiro/contas"
          context={
            b.beforeStartCount > 0
              ? `Soma das contas marcadas como disponíveis. Atenção: ${b.beforeStartCount} ${b.beforeStartCount === 1 ? "lançamento pago antes do saldo inicial não entra" : "lançamentos pagos antes do saldo inicial não entram"} neste valor (veja em Contas).`
              : "Soma das contas marcadas como disponíveis."
          }
        >
          <MoneyText
            value={b.available}
            variant="hero"
            tone={b.available.startsWith("-") ? "critical" : "default"}
          />
        </Row>
        <Row
          question="Quanto vou receber?"
          href="/financeiro/receitas"
          context={`Receitas previstas e ainda não recebidas em ${formatMonth(b.month)}.`}
        >
          <MoneyText value={b.toReceive} variant="kpi" tone="positive" />
        </Row>
        <Row
          question="Quanto ainda preciso pagar?"
          href="/financeiro/calendario"
          context={
            b.overdueToPay !== "0.00"
              ? `Inclui ${formatMoney(b.overdueToPay)} já vencidos.`
              : "Contas, parcelas e faturas pendentes do mês."
          }
        >
          <MoneyText
            value={b.toPay}
            variant="kpi"
            tone={b.overdueToPay !== "0.00" ? "critical" : "default"}
          />
        </Row>
        <Row
          question="Quanto sobra este mês?"
          href="/financeiro/painel"
          context={`Receitas − despesas previstas${commitment ? ` (${formatPercent(commitment)} da renda comprometida)` : ""}. Saldo estimado no fim do mês: ${formatMoney(b.endOfMonth)}.`}
        >
          <MoneyText
            value={b.leftover}
            variant="kpi"
            sign="always"
            tone={b.leftover.startsWith("-") ? "critical" : "positive"}
          />
        </Row>
        <Row
          question="Quanto tenho em dívidas?"
          href="/financeiro/patrimonio"
          context="Cartões (com parcelas futuras), parcelamentos e dívidas cadastradas."
        >
          <MoneyText value={b.liabilities} variant="kpi" />
        </Row>
        <Row
          question="Quanto tenho em patrimônio?"
          href="/financeiro/patrimonio"
          context="Líquido: ativos menos passivos."
        >
          <MoneyText
            value={b.netWorth}
            variant="kpi"
            tone={b.netWorth.startsWith("-") ? "critical" : "default"}
          />
        </Row>
        <Row
          question="Quanto minha renda cresceu?"
          href="/financeiro/relatorios/receita-mensal"
          context={growthText(b.incomeGrowth, b.month)}
        >
          <Delta change={b.incomeGrowth.change} />
        </Row>
        <Row
          question="Quanto minhas despesas cresceram?"
          href="/financeiro/relatorios/despesa-mensal"
          context={growthText(b.expenseGrowth, b.month)}
        >
          <Delta change={b.expenseGrowth.change} />
        </Row>
        <Row
          question="Qual categoria mais consome meu dinheiro?"
          href="/financeiro/relatorios/gastos-por-categoria"
          context={
            b.topCategory
              ? `${formatPercent(b.topCategory.share)} das despesas de ${formatMonth(b.month)}.`
              : "Sem despesas neste mês."
          }
        >
          {b.topCategory ? (
            <span className="flex flex-wrap items-baseline gap-x-3">
              <span className="figure-kpi">{b.topCategory.name}</span>
              <MoneyText value={b.topCategory.amount} className="text-lg text-ink-2" />
            </span>
          ) : (
            <span className="figure-kpi text-ink-3">—</span>
          )}
        </Row>
        <Row
          question="Como estarão minhas finanças daqui a 3, 6 e 12 meses?"
          href="/financeiro/previsao"
          context={[
            b.recurringCount === 0
              ? "Sem receitas e despesas recorrentes cadastradas, a projeção só repete o saldo de hoje: salário e contas fixas futuras não entram. Marque “Repetir” no salário e nas contas fixas."
              : null,
            b.firstNegative
              ? `Atenção: o caixa pode ficar negativo em ${formatMonth(b.firstNegative.month)}.`
              : "Cenário realista: nenhum mês negativo no período.",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="grid gap-2 sm:grid-cols-3">
            {b.projection.map((p) => (
              <div
                key={p.months}
                className="grid gap-0.5 rounded-card border border-line px-3 py-2"
              >
                <span className="text-xs text-ink-3">{p.months} meses</span>
                <MoneyText
                  value={p.balance}
                  variant="table"
                  className="text-base font-semibold"
                  tone={p.negative ? "critical" : "default"}
                />
                <span
                  className={
                    p.negative ? "text-xs font-medium text-critical" : "text-xs text-ink-3"
                  }
                >
                  {p.negative ? "▼ negativo" : "no azul"}
                </span>
              </div>
            ))}
          </div>
        </Row>
      </Panel>

      <section className="grid gap-2">
        <h2 className="title-section">O que mais chama atenção</h2>
        <Panel className="overflow-hidden">
          <InsightsList insights={b.insights} />
        </Panel>
      </section>
    </div>
  );
}
