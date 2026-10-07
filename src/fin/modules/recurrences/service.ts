import type { Recurrence } from "@prisma/client";
import type { ExpenseNature, PaymentMethod } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import {
  addDays,
  addMonths,
  fromDbDate,
  type ISODate,
  lastDayOfMonth,
  monthKeyOf,
  parseISODate,
  toDbDate,
  weekdayOf,
} from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { resolveInvoice } from "@fin/modules/credit-cards/domain/invoice-cycle";
import { ensureInvoice } from "@fin/modules/credit-cards/service";
import { occurrencesBetween, type ScheduleRule } from "./domain/schedule";
import type { RepeatInput } from "./schemas";

/** Horizonte de materialização: até o fim do mês daqui a 12 meses. */
export function horizonFor(today: ISODate): ISODate {
  return lastDayOfMonth(monthKeyOf(addMonths(today, 12)));
}

export interface RecurrenceTemplate {
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: string;
  categoryId: string | null;
  accountId: string | null;
  creditCardId?: string | null;
  paymentMethod: PaymentMethod | null;
  nature: ExpenseNature | null;
}

export function ruleOf(r: Recurrence): ScheduleRule {
  return {
    frequency: r.frequency,
    intervalCount: r.intervalCount,
    dayRule: r.dayRule,
    dayOfMonth: r.dayOfMonth,
    weekday: r.weekday,
    monthOfYear: r.monthOfYear,
    nonBusinessDayShift: r.nonBusinessDayShift,
    startDate: fromDbDate(r.startDate),
    endDate: r.endDate ? fromDbDate(r.endDate) : null,
    maxOccurrences: r.maxOccurrences,
  };
}

function scheduleFields(repeat: RepeatInput, startDate: ISODate) {
  const start = parseISODate(startDate);
  return {
    frequency: repeat.frequency,
    intervalCount: repeat.intervalCount,
    dayRule: repeat.dayRule,
    dayOfMonth: repeat.dayRule === "LAST_BUSINESS_DAY" ? null : (repeat.dayOfMonth ?? start.day),
    weekday: repeat.frequency === "WEEKLY" ? weekdayOf(startDate) : null,
    monthOfYear: repeat.frequency === "YEARLY" ? start.month : null,
    nonBusinessDayShift: repeat.dayRule === "FIXED_DAY" ? repeat.nonBusinessDayShift : "NONE",
    startDate: toDbDate(startDate),
    endDate: repeat.endMode === "until" && repeat.endDate ? toDbDate(repeat.endDate) : null,
    maxOccurrences: repeat.endMode === "count" ? repeat.maxOccurrences : null,
    isEstimatedAmount: repeat.isEstimatedAmount,
  } as const;
}

function templateFields(t: RecurrenceTemplate) {
  return {
    type: t.type,
    description: t.description,
    amount: t.amount,
    categoryId: t.categoryId,
    accountId: t.creditCardId ? null : t.accountId,
    creditCardId: t.creditCardId ?? null,
    paymentMethod: t.paymentMethod,
    nature: t.type === "EXPENSE" ? (t.nature ?? "FIXED") : null,
  };
}

/**
 * Cria as ocorrências que faltam até o horizonte. Idempotente: a chave (recorrência, data natural)
 * é única, então rodar de novo nunca duplica — nem recria ocorrências que o usuário excluiu.
 */
export async function materialize(
  db: DbClient,
  recurrence: Recurrence,
  today: ISODate,
  from?: ISODate,
): Promise<number> {
  if (recurrence.pausedAt || recurrence.deletedAt) return 0;
  const until = horizonFor(today);
  const start =
    from ??
    (recurrence.generatedUntil
      ? addDays(fromDbDate(recurrence.generatedUntil), 1)
      : fromDbDate(recurrence.startDate));
  if (start > until) return 0;
  const occurrences = occurrencesBetween(ruleOf(recurrence), start, until);
  // Série no cartão: cada ocorrência cai na fatura do seu ciclo e vence com ela.
  const card = recurrence.creditCardId
    ? await db.creditCard.findUnique({ where: { id: recurrence.creditCardId } })
    : null;
  const invoiceByMonth = new Map<string, { id: string; dueDate: Date }>();
  if (card) {
    for (const o of occurrences) {
      const month = resolveInvoice(o.naturalDate, card.closingDay, card.dueDay).referenceMonth;
      if (!invoiceByMonth.has(month)) {
        const invoice = await ensureInvoice(db, card, month);
        invoiceByMonth.set(month, { id: invoice.id, dueDate: invoice.dueDate });
      }
    }
  }
  const created = occurrences.length
    ? await db.transaction.createMany({
        data: occurrences.map((o) => {
          const invoice = card
            ? invoiceByMonth.get(
                resolveInvoice(o.naturalDate, card.closingDay, card.dueDay).referenceMonth,
              )
            : undefined;
          return {
            workspaceId: recurrence.workspaceId,
            type: recurrence.type,
            status: "PENDING" as const,
            description: recurrence.description,
            amount: recurrence.amount,
            date: toDbDate(o.naturalDate),
            dueDate: invoice ? invoice.dueDate : toDbDate(o.dueDate),
            accountId: card ? null : recurrence.accountId,
            creditCardId: card ? card.id : null,
            invoiceId: invoice?.id ?? null,
            categoryId: recurrence.categoryId,
            paymentMethod: recurrence.paymentMethod,
            nature: recurrence.nature,
            recurrenceId: recurrence.id,
            recurrenceDate: toDbDate(o.naturalDate),
          };
        }),
        skipDuplicates: true,
      })
    : { count: 0 };
  await db.recurrence.update({
    where: { id: recurrence.id },
    data: { generatedUntil: toDbDate(until) },
  });
  return created.count;
}

/** Ocorrências pendentes que ninguém tocou (sem edição manual e sem anexo) — seguras para apagar. */
function untouchedPending(recurrenceId: string, fromDate: ISODate) {
  return {
    recurrenceId,
    status: "PENDING" as const,
    isRecurrenceOverride: false,
    recurrenceDate: { gte: toDbDate(fromDate) },
    attachments: { none: {} },
    commission: null,
  };
}

export async function createRecurrence(
  db: DbClient,
  ctx: ServiceContext,
  template: RecurrenceTemplate,
  repeat: RepeatInput,
  startDate: ISODate,
  today: ISODate,
): Promise<Recurrence> {
  const recurrence = await db.recurrence.create({
    data: {
      workspaceId: ctx.workspaceId,
      ...templateFields(template),
      ...scheduleFields(repeat, startDate),
    },
  });
  await materialize(db, recurrence, today);
  await audit(db, ctx, {
    action: "recurrence.create",
    entityType: "Recurrence",
    entityId: recurrence.id,
    after: recurrence,
  });
  return recurrence;
}

export async function getOwnedRecurrence(
  db: DbClient,
  ctx: ServiceContext,
  id: string,
): Promise<Recurrence> {
  const r = await db.recurrence.findFirst({
    where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
  });
  if (!r) throw new AppError("NOT_FOUND");
  return r;
}

/**
 * Aplica mudanças de conteúdo (valor, descrição, categoria, conta…) à regra e às ocorrências
 * pendentes não editadas a partir de `fromDate` (ou todas, se null).
 */
export async function applyTemplateToSeries(
  db: DbClient,
  ctx: ServiceContext,
  recurrence: Recurrence,
  template: RecurrenceTemplate,
  fromDate: ISODate | null,
) {
  const fields = templateFields(template);
  await db.recurrence.update({ where: { id: recurrence.id }, data: fields });
  await db.transaction.updateMany({
    where: {
      recurrenceId: recurrence.id,
      status: "PENDING",
      isRecurrenceOverride: false,
      deletedAt: null,
      ...(fromDate ? { recurrenceDate: { gte: toDbDate(fromDate) } } : {}),
    },
    data: {
      description: fields.description,
      amount: fields.amount,
      categoryId: fields.categoryId,
      accountId: fields.accountId,
      paymentMethod: fields.paymentMethod,
      nature: fields.nature,
    },
  });
  await audit(db, ctx, {
    action: "recurrence.update",
    entityType: "Recurrence",
    entityId: recurrence.id,
    before: recurrence,
    after: { ...recurrence, ...fields, appliedFrom: fromDate ?? "todas as pendentes" },
  });
}

/**
 * Encerra a série: nada é gerado depois de `lastDate`, e as ocorrências pendentes intocadas
 * posteriores são removidas.
 */
export async function endSeries(
  db: DbClient,
  ctx: ServiceContext,
  recurrence: Recurrence,
  lastDate: ISODate,
) {
  const start = fromDbDate(recurrence.startDate);
  if (lastDate < start) {
    await db.transaction.deleteMany({ where: untouchedPending(recurrence.id, start) });
    await db.recurrence.update({
      where: { id: recurrence.id },
      data: { deletedAt: new Date(), endDate: toDbDate(start) },
    });
  } else {
    await db.transaction.deleteMany({
      where: untouchedPending(recurrence.id, addDays(lastDate, 1)),
    });
    await db.recurrence.update({
      where: { id: recurrence.id },
      data: { endDate: toDbDate(lastDate) },
    });
  }
  await audit(db, ctx, {
    action: "recurrence.end",
    entityType: "Recurrence",
    entityId: recurrence.id,
    after: { lastDate },
  });
}

/**
 * Mudança de calendário a partir de uma data: a série antiga termina na véspera e uma nova
 * começa em `fromDate` com a nova regra. O histórico anterior fica intacto.
 */
export async function rescheduleFrom(
  db: DbClient,
  ctx: ServiceContext,
  recurrence: Recurrence,
  template: RecurrenceTemplate,
  repeat: RepeatInput,
  fromDate: ISODate,
  today: ISODate,
): Promise<Recurrence> {
  await endSeries(db, ctx, recurrence, addDays(fromDate, -1));
  const next = await createRecurrence(db, ctx, template, repeat, fromDate, today);
  await db.subscription.updateMany({
    where: { recurrenceId: recurrence.id },
    data: { recurrenceId: next.id },
  });
  return next;
}

/** Pausar: para de gerar e remove as pendentes intocadas a partir de hoje. */
export async function setPaused(ctx: ServiceContext, id: string, paused: boolean, today: ISODate) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const r = await getOwnedRecurrence(tx, ctx, id);
    if (paused) {
      await tx.transaction.deleteMany({ where: untouchedPending(r.id, today) });
      await tx.recurrence.update({ where: { id }, data: { pausedAt: new Date() } });
    } else {
      const resumed = await tx.recurrence.update({
        where: { id },
        data: { pausedAt: null, generatedUntil: toDbDate(addDays(today, -1)) },
      });
      await materialize(tx, resumed, today);
    }
    await audit(tx, ctx, {
      action: paused ? "recurrence.pause" : "recurrence.resume",
      entityType: "Recurrence",
      entityId: id,
    });
  });
}

/** Exclui a regra: mantém o histórico (pagos, editados, com anexo) e remove as pendentes futuras intocadas. */
export async function deleteRecurrence(ctx: ServiceContext, id: string, today: ISODate) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const r = await getOwnedRecurrence(tx, ctx, id);
    await tx.transaction.deleteMany({ where: untouchedPending(r.id, today) });
    await tx.recurrence.update({ where: { id }, data: { deletedAt: new Date() } });
    await audit(tx, ctx, {
      action: "recurrence.delete",
      entityType: "Recurrence",
      entityId: id,
      before: r,
    });
  });
}

/** Job diário: estende todas as séries ativas até o horizonte. */
export async function materializeAll(
  today: ISODate,
): Promise<{ recurrences: number; created: number }> {
  const horizon = toDbDate(horizonFor(today));
  const pending = await prisma.recurrence.findMany({
    where: {
      deletedAt: null,
      pausedAt: null,
      OR: [{ generatedUntil: null }, { generatedUntil: { lt: horizon } }],
    },
  });
  let created = 0;
  for (const r of pending) created += await materialize(prisma, r, today);
  return { recurrences: pending.length, created };
}
