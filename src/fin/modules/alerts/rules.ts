import type { NotificationPriority } from "@prisma/client";
import {
  addDays,
  addMonthsToKey,
  diffInDays,
  formatDate,
  formatMonth,
  fromDbDate,
  type ISODate,
  lastDayOfMonth,
  monthKeyOf,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { formatMoney, formatPercent, sumMoney, toMoney } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { upcomingPayments } from "@fin/modules/dashboard/queries";
import { budgetOverview } from "@fin/modules/budgets/queries";
import { forecast } from "@fin/modules/forecast/queries";
import { emergencyFund } from "@fin/modules/goals/queries";
import { monthTotals } from "@fin/modules/transactions/queries";

export interface AlertDraft {
  code: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  /** Mesma situação = mesma chave: o alerta não duplica e some quando deixa de valer. */
  dedupeKey: string;
  validUntil?: Date;
}

export type AlertRule = (ctx: ServiceContext, today: ISODate) => Promise<AlertDraft[]>;

function when(due: ISODate, today: ISODate): string {
  const d = diffInDays(due, today);
  if (d === 0) return "vence hoje";
  if (d === 1) return "vence amanhã";
  if (d < 0) return `venceu há ${-d} ${-d === 1 ? "dia" : "dias"}`;
  return `vence em ${d} dias`;
}

/** Contas: vencidas (crítico), hoje/amanhã (importante). Faturas: até 3 dias (importante), vencidas (crítico). */
export const billsRule: AlertRule = async (ctx, today) => {
  const items = await upcomingPayments(ctx, today, 3);
  const drafts: AlertDraft[] = [];
  for (const i of items) {
    const days = diffInDays(i.dueDate, today);
    if (i.kind === "bill" && days > 1) continue;
    const priority: NotificationPriority = days < 0 ? "CRITICAL" : "IMPORTANT";
    drafts.push({
      code: i.kind === "invoice" ? "invoice.due" : "bill.due",
      priority,
      title: `${i.description} ${when(i.dueDate, today)}`,
      body: `${formatMoney(i.amount)} · vencimento ${formatDate(i.dueDate)}.`,
      href: i.href,
      entityType: i.kind === "invoice" ? "CreditCardInvoice" : "Transaction",
      entityId: i.id,
      dedupeKey: `${i.kind}:${i.id}:${days < 0 ? "overdue" : "soon"}`,
    });
  }
  return drafts;
};

/** Receitas atrasadas (comissão ou outra receita prevista que não entrou). */
export const lateIncomeRule: AlertRule = async (ctx, today) => {
  const late = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      type: "INCOME",
      status: "PENDING",
      dueDate: { lt: toDbDate(today) },
    },
    select: { id: true, description: true, amount: true, dueDate: true },
    orderBy: { dueDate: "asc" },
    take: 20,
  });
  return late.map((t) => ({
    code: "income.late",
    priority: "ATTENTION" as const,
    title: `${t.description} está atrasada`,
    body: `${formatMoney(t.amount)} previstos para ${formatDate(fromDbDate(t.dueDate))} ainda não entraram. Marque como recebida ou ajuste a previsão.`,
    href: `/financeiro/receitas?mes=${monthKeyOf(fromDbDate(t.dueDate))}`,
    entityType: "Transaction",
    entityId: t.id,
    dedupeKey: `income-late:${t.id}`,
  }));
};

/** Comissões previstas a receber no mês. */
export const commissionsToReceiveRule: AlertRule = async (ctx, today) => {
  const month = monthKeyOf(today);
  const pending = await prisma.commission.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      transaction: {
        status: "PENDING",
        deletedAt: null,
        dueDate: {
          gte: toDbDate(today),
          lte: toDbDate(lastDayOfMonth(month)),
        },
      },
    },
    select: { transaction: { select: { amount: true } } },
  });
  if (pending.length === 0) return [];
  const total = sumMoney(pending.map((p) => p.transaction.amount));
  return [
    {
      code: "commissions.pending",
      priority: "INFO",
      title: `Você tem ${formatMoney(total)} em comissões previstas para receber`,
      body: `${pending.length} ${pending.length === 1 ? "comissão prevista" : "comissões previstas"} até o fim de ${formatMonth(month)}.`,
      href: "/financeiro/comissoes",
      dedupeKey: `commissions-pending:${month}:${total.toFixed(2)}`,
    },
  ];
};

/** Despesas do mês crescendo muito em relação ao mês anterior. */
export const expenseGrowthRule: AlertRule = async (ctx, today) => {
  const month = monthKeyOf(today);
  const [now, prev] = await Promise.all([
    monthTotals(ctx, month, today),
    monthTotals(ctx, addMonthsToKey(month, -1), today),
  ]);
  const current = toMoney(now.expense.total);
  const previous = toMoney(prev.expense.total);
  if (previous.lessThanOrEqualTo(0)) return [];
  const growth = current.minus(previous).dividedBy(previous);
  if (growth.lessThan(0.2)) return [];
  return [
    {
      code: "expenses.growth",
      priority: "ATTENTION",
      title: `Suas despesas aumentaram ${formatPercent(growth)} em relação ao mês anterior`,
      body: `${formatMoney(current)} previstos em ${formatMonth(month)} contra ${formatMoney(previous)} em ${formatMonth(addMonthsToKey(month, -1))}.`,
      href: "/financeiro/despesas",
      dedupeKey: `expenses-growth:${month}`,
    },
  ];
};

/** Renovação anual de assinatura nos próximos 15 dias. */
export const subscriptionRenewalRule: AlertRule = async (ctx, today) => {
  const subs = await prisma.subscription.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: "ACTIVE",
      recurrence: { frequency: "YEARLY", deletedAt: null },
    },
    include: {
      recurrence: {
        include: {
          transactions: {
            where: {
              deletedAt: null,
              status: "PENDING",
              dueDate: { gte: toDbDate(today), lte: toDbDate(addDays(today, 15)) },
            },
            take: 1,
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
  });
  return subs
    .filter((s) => s.recurrence.transactions.length > 0)
    .map((s) => {
      const t = s.recurrence.transactions[0]!;
      return {
        code: "subscription.renewal",
        priority: "INFO" as const,
        title: `${s.name} renova em ${formatDate(fromDbDate(t.dueDate))}`,
        body: `Cobrança anual de ${formatMoney(t.amount)}. Ainda usa? Dá tempo de cancelar.`,
        href: "/financeiro/assinaturas",
        entityType: "Subscription",
        entityId: s.id,
        dedupeKey: `renewal:${s.id}:${fromDbDate(t.dueDate)}`,
      };
    });
};

/** Orçamento: avisa no limiar (atenção) e ao estourar (importante). */
export const budgetRule: AlertRule = async (ctx, today) => {
  const month = monthKeyOf(today);
  const overview = await budgetOverview(ctx, month);
  return overview.rows
    .filter((r) => r.state !== "ok")
    .map((r) => ({
      code: r.state === "over" ? "budget.over" : "budget.threshold",
      priority: r.state === "over" ? ("IMPORTANT" as const) : ("ATTENTION" as const),
      title:
        r.state === "over"
          ? `Orçamento de ${r.name.toLowerCase()} estourado: ${formatMoney(r.spent)} de ${formatMoney(r.limit)}`
          : `Você já utilizou ${formatPercent(r.ratio)} do orçamento de ${r.name.toLowerCase()}`,
      body:
        r.state === "over"
          ? `${formatMoney(r.excess)} acima do limite de ${formatMonth(month)}.`
          : `Restam ${formatMoney(r.available)} até o fim do mês.`,
      href: `/financeiro/orcamento?mes=${month}`,
      entityType: "Category",
      entityId: r.categoryId,
      dedupeKey: `budget:${r.categoryId}:${month}:${r.state}`,
    }));
};

/** Reserva de emergência cobrindo menos de 3 meses de despesas. */
export const reserveRule: AlertRule = async (ctx, today) => {
  const fund = await emergencyFund(ctx, today);
  if (!fund.goal || fund.months === null || Number.parseFloat(fund.months) >= 3) return [];
  return [
    {
      code: "reserve.low",
      priority: "ATTENTION",
      title: `Sua reserva cobre ${fund.months.replace(".", ",")} meses de despesas`,
      body: `A recomendação é de pelo menos 3 meses (${formatMoney(fund.monthlyCost)} por mês em média).`,
      href: "/financeiro/metas",
      dedupeKey: `reserve-low:${monthKeyOf(today)}`,
    },
  ];
};

/** Fluxo de caixa projetado negativo em algum mês dos próximos 12 (cenário realista). */
export const negativeCashRule: AlertRule = async (ctx, today) => {
  const f = await forecast(ctx, today, 12, "realistic");
  if (!f.firstNegative) return [];
  return [
    {
      code: "forecast.negative",
      priority: "CRITICAL",
      title: `Seu fluxo de caixa projetado ficará negativo em ${formatMonth(f.firstNegative.month)}`,
      body: `O saldo chega a ${formatMoney(f.firstNegative.closing)} no cenário realista. Veja a previsão e ajuste antes.`,
      href: "/financeiro/previsao",
      dedupeKey: `forecast-negative:${f.firstNegative.month}`,
    },
  ];
};

/** Regras ativas. Novos módulos (orçamento, reserva, previsão) acrescentam as suas aqui. */
export const ALERT_RULES: AlertRule[] = [
  billsRule,
  lateIncomeRule,
  commissionsToReceiveRule,
  expenseGrowthRule,
  subscriptionRenewalRule,
  budgetRule,
  reserveRule,
  negativeCashRule,
];
