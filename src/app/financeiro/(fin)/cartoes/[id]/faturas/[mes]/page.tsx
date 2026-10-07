import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MoneyText } from "@fin/components/shared/money-text";
import { formatMoney, toMoney } from "@fin/lib/money";
import { PageHeader } from "@fin/components/shared/page-header";
import { Panel } from "@fin/components/shared/panel";
import { Button } from "@fin/components/ui/button";
import { requirePageContext } from "@fin/lib/context";
import { formatDate, formatMonth, isMonthKey } from "@fin/lib/dates";
import { InvoiceActions } from "@fin/modules/credit-cards/components/invoice-actions";
import { getInvoiceDetail } from "@fin/modules/credit-cards/queries";
import { INVOICE_STATUS_LABELS } from "@fin/modules/credit-cards/types";
import { TransactionList } from "@fin/modules/transactions/components/transaction-list";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Fatura" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string; mes: string }>;
}) {
  const ctx = await requirePageContext();
  const { id, mes } = await params;
  if (!UUID.test(id) || !isMonthKey(mes)) notFound();
  const [detail, options] = await Promise.all([
    getInvoiceDetail(ctx, id, mes, ctx.today),
    loadFormOptions(ctx),
  ]);
  if (!detail) notFound();
  const { card, invoice } = detail;
  const diff = invoice.statementAmount
    ? toMoney(invoice.statementAmount).minus(invoice.total)
    : toMoney(0);

  return (
    <div className="grid gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2.5">
          <Link href={`/financeiro/cartoes/${card.id}`}>
            <ChevronLeftIcon /> {card.name}
          </Link>
        </Button>
        <PageHeader
          title={`Fatura de ${formatMonth(mes)}`}
          description={`${card.name} · fecha em ${formatDate(invoice.closingDate)} · vence em ${formatDate(invoice.dueDate)}`}
          actions={
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" asChild aria-label="Fatura anterior">
                <Link href={`/financeiro/cartoes/${card.id}/faturas/${detail.previousMonth}`}>
                  <ChevronLeftIcon />
                </Link>
              </Button>
              <Button variant="ghost" size="icon-sm" asChild aria-label="Próxima fatura">
                <Link href={`/financeiro/cartoes/${card.id}/faturas/${detail.nextMonth}`}>
                  <ChevronRightIcon />
                </Link>
              </Button>
            </div>
          }
        />
      </div>

      <Panel className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Total da fatura</span>
          <MoneyText value={invoice.total} variant="kpi" />
          <span className="text-xs text-ink-3">
            {INVOICE_STATUS_LABELS[invoice.status]} · {invoice.itemCount}{" "}
            {invoice.itemCount === 1 ? "item" : "itens"}
          </span>
        </div>
        <div className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Pago</span>
          <MoneyText value={invoice.paid} variant="kpi" />
        </div>
        <div className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Falta pagar</span>
          <MoneyText
            value={invoice.remaining}
            variant="kpi"
            tone={
              invoice.remaining !== "0.00" && invoice.dueDate < ctx.today ? "critical" : "default"
            }
          />
        </div>
        <div className="grid content-start gap-1 px-5 py-4">
          <span className="text-[13px] text-ink-2">Valor no banco</span>
          {invoice.statementAmount ? (
            <MoneyText value={invoice.statementAmount} variant="kpi" />
          ) : (
            <span className="figure-kpi text-ink-3">—</span>
          )}
          <span className={`text-xs ${!diff.isZero() ? "text-warning-text" : "text-ink-3"}`}>
            {invoice.statementAmount
              ? !diff.isZero()
                ? `Diferença de ${formatMoney(diff, { sign: "always" })}`
                : "Confere com as compras"
              : "Ainda não conferida"}
          </span>
        </div>
      </Panel>

      <InvoiceActions
        invoice={invoice}
        cardName={card.name}
        paymentAccountId={card.paymentAccountId}
        accounts={options.accounts}
        today={ctx.today}
        hasPayments={detail.payments.length > 0}
      />

      {detail.payments.length ? (
        <section className="grid gap-2">
          <h2 className="title-section">Pagamentos</h2>
          <Panel>
            <ul className="divide-y divide-line">
              {detail.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span>
                    {formatDate(p.date)} · {p.accountName}
                  </span>
                  <MoneyText value={p.amount} variant="table" className="font-medium" />
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      <section className="grid gap-2">
        <h2 className="title-section">Compras desta fatura</h2>
        <TransactionList
          transactions={detail.items}
          today={ctx.today}
          accounts={options.accounts}
          emptyType="EXPENSE"
          emptyTitle="Nenhuma compra nesta fatura"
          emptyDescription="Registre uma despesa escolhendo “Cartão de crédito”: ela cai na fatura do ciclo automaticamente."
        />
      </section>
    </div>
  );
}
