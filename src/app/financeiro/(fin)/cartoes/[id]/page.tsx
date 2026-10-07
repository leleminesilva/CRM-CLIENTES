import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MoneyText } from "@fin/components/shared/money-text";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { requirePageContext } from "@fin/lib/context";
import { formatDayMonth, formatMonth } from "@fin/lib/dates";
import { CardArt } from "@fin/modules/credit-cards/components/card-art";
import { LimitMeter } from "@fin/modules/credit-cards/components/limit-meter";
import { getCard, listCardInvoices, recentCardPurchases } from "@fin/modules/credit-cards/queries";
import { BRAND_LABELS, INVOICE_STATUS_LABELS } from "@fin/modules/credit-cards/types";
import { PlanCard } from "@fin/modules/installments/components/plan-card";
import { listPlans } from "@fin/modules/installments/queries";
import { TransactionList } from "@fin/modules/transactions/components/transaction-list";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Cartão" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageContext();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const card = await getCard(ctx, id, ctx.today);
  if (!card) notFound();
  const [recent, plans, invoices, options] = await Promise.all([
    recentCardPurchases(ctx, id, ctx.today),
    listPlans(ctx, { creditCardId: id }),
    listCardInvoices(ctx, id, ctx.today),
    loadFormOptions(ctx),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2.5">
          <Link href="/financeiro/cartoes">
            <ChevronLeftIcon /> Cartões
          </Link>
        </Button>
        <PageHeader
          title={card.name}
          description={`${card.issuer} · ${BRAND_LABELS[card.brand]} · fecha dia ${card.closingDay}, vence dia ${card.dueDay}`}
        />
      </div>

      <Panel className="grid gap-5 p-5 md:grid-cols-[12rem_1fr] md:items-center">
        <CardArt
          name={card.name}
          issuer={card.issuer}
          lastFour={card.lastFour}
          color={card.color}
        />
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1">
              <span className="text-[13px] text-ink-2">Limite</span>
              <MoneyText value={card.creditLimit} variant="kpi" />
            </div>
            <div className="grid gap-1">
              <span className="text-[13px] text-ink-2">Utilizado</span>
              <MoneyText value={card.used} variant="kpi" />
            </div>
            <div className="grid gap-1">
              <span className="text-[13px] text-ink-2">Disponível</span>
              <MoneyText
                value={card.available}
                variant="kpi"
                tone={card.available.startsWith("-") ? "critical" : "default"}
              />
            </div>
          </div>
          <LimitMeter limit={card.creditLimit} used={card.used} available={card.available} />
          <p className="text-xs text-ink-3">
            O utilizado inclui parcelas futuras, como o banco calcula.
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Fatura atual", inv: card.currentInvoice },
          { label: "Próxima fatura", inv: card.nextInvoice },
        ].map(({ label, inv }) => (
          <Link
            key={label}
            href={`/financeiro/cartoes/${card.id}/faturas/${inv.referenceMonth}`}
            className="block rounded-card focus-visible:outline-2"
          >
            <Panel className="grid gap-1 p-5 transition-colors hover:border-line-strong">
              <span className="text-[13px] text-ink-2">
                {label} · {formatMonth(inv.referenceMonth)}
              </span>
              <MoneyText value={inv.total} variant="kpi" />
              <span className="text-xs text-ink-3">
                {INVOICE_STATUS_LABELS[inv.status]} · fecha {formatDayMonth(inv.closingDate)} ·
                vence {formatDayMonth(inv.dueDate)}
              </span>
            </Panel>
          </Link>
        ))}
      </div>

      {plans.length ? (
        <section className="grid gap-2">
          <h2 className="title-section">Compras parceladas neste cartão</h2>
          <Panel>
            <ul className="divide-y divide-line">
              {plans.map((p) => (
                <PlanCard key={p.id} plan={p} accounts={options.accounts} today={ctx.today} />
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="title-section">Compras recentes</h2>
        <TransactionList
          transactions={recent}
          today={ctx.today}
          accounts={options.accounts}
          grouped={false}
          emptyType="EXPENSE"
          emptyTitle="Nenhuma compra ainda"
          emptyDescription="Registre uma despesa escolhendo este cartão."
        />
      </section>

      {invoices.length ? (
        <section className="grid gap-2">
          <h2 className="title-section">Faturas</h2>
          <Panel>
            <ul className="divide-y divide-line">
              {invoices.map((inv) => (
                <li key={inv.referenceMonth}>
                  <Link
                    href={`/financeiro/cartoes/${card.id}/faturas/${inv.referenceMonth}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface-sunken"
                  >
                    <span className="first-letter:uppercase">
                      {formatMonth(inv.referenceMonth)}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="text-xs text-ink-3">
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </span>
                      <MoneyText value={inv.total} variant="table" className="font-medium" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
