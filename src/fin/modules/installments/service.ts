import { audit } from "@fin/lib/audit";
import { type ISODate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { sumMoney, toMoney } from "@fin/lib/money";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import {
  getOwnedCard,
  invoiceForPurchase,
  refreshInvoiceStatus,
} from "@fin/modules/credit-cards/service";
import { planInstallments } from "./domain/installments";
import type { CreatePlanInput } from "./schemas";

/**
 * Compra parcelada (R4): gera as parcelas restantes como lançamentos. No cartão, cada parcela
 * cai numa fatura; em boleto/carnê, vence mês a mês na conta.
 */
export async function createInstallmentPlan(
  ctx: ServiceContext,
  input: CreatePlanInput,
  today: ISODate,
) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, workspaceId: ctx.workspaceId, kind: "EXPENSE" },
    });
    if (!category) throw new AppError("CATEGORY_KIND_MISMATCH");
    const card = input.creditCardId ? await getOwnedCard(tx, ctx, input.creditCardId) : null;
    if (card?.archivedAt) throw new AppError("CARD_ARCHIVED");
    if (input.accountId) {
      const acc = await tx.account.findFirst({
        where: { id: input.accountId, workspaceId: ctx.workspaceId },
      });
      if (!acc) throw new AppError("NOT_FOUND", "Conta não encontrada.");
    }
    let planned;
    try {
      planned = planInstallments({
        totalAmount: input.totalAmount,
        count: input.installmentCount,
        priorPaidCount: input.priorPaidCount,
        purchaseDate: input.purchaseDate,
        card: card ? { closingDay: card.closingDay, dueDay: card.dueDay } : undefined,
        firstDueDate: input.firstDueDate ?? undefined,
      });
    } catch (e) {
      throw new AppError("VALIDATION", e instanceof Error ? e.message : undefined);
    }

    const plan = await tx.installmentPlan.create({
      data: {
        workspaceId: ctx.workspaceId,
        description: input.description,
        merchant: input.merchant,
        categoryId: category.id,
        totalAmount: input.totalAmount,
        cashPrice: input.cashPrice,
        installmentCount: input.installmentCount,
        priorPaidCount: input.priorPaidCount,
        purchaseDate: toDbDate(input.purchaseDate),
        firstDueDate: toDbDate(planned[0]!.dueDate),
        creditCardId: card?.id ?? null,
        accountId: card ? null : input.accountId,
        paymentMethod: card ? "CREDIT_CARD" : input.paymentMethod,
        notes: input.notes,
      },
    });

    for (const p of planned) {
      const invoice = card ? await invoiceForPurchase(tx, card, p.date) : null;
      await tx.transaction.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: "EXPENSE",
          status: "PENDING",
          description: input.description,
          amount: p.amount.toFixed(2),
          date: toDbDate(p.date),
          dueDate: invoice ? invoice.dueDate : toDbDate(p.dueDate),
          accountId: card ? null : input.accountId,
          creditCardId: card?.id ?? null,
          invoiceId: invoice?.id ?? null,
          categoryId: category.id,
          nature: "VARIABLE",
          paymentMethod: card ? "CREDIT_CARD" : input.paymentMethod,
          installmentPlanId: plan.id,
          installmentNumber: p.number,
        },
      });
      if (invoice) await refreshInvoiceStatus(tx, invoice.id, today);
    }
    await audit(tx, ctx, {
      action: "installments.create",
      entityType: "InstallmentPlan",
      entityId: plan.id,
      after: plan,
    });
    return plan;
  });
}

/**
 * Quitação antecipada: parcelas pendentes são canceladas e substituídas por um pagamento único
 * (com desconto, se houver). Parcelas em faturas já pagas não mudam.
 */
export async function settleEarly(
  ctx: ServiceContext,
  input: { planId: string; accountId: string; amount: string; date: ISODate },
  today: ISODate,
) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.findFirst({
      where: { id: input.planId, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!plan) throw new AppError("NOT_FOUND");
    const pending = await tx.transaction.findMany({
      where: {
        installmentPlanId: plan.id,
        status: "PENDING",
        deletedAt: null,
        OR: [{ invoiceId: null }, { invoice: { status: { not: "PAID" } } }],
      },
    });
    if (pending.length === 0) throw new AppError("PLAN_FINISHED");
    const outstanding = sumMoney(pending.map((p) => p.amount));
    if (toMoney(input.amount).greaterThan(outstanding))
      throw new AppError("PAYMENT_TOO_HIGH", "O valor passa do saldo devedor do parcelamento.");
    await tx.transaction.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: "CANCELED" },
    });
    for (const inv of new Set(
      pending.map((p) => p.invoiceId).filter((x): x is string => Boolean(x)),
    )) {
      await refreshInvoiceStatus(tx, inv, today);
    }
    await tx.transaction.create({
      data: {
        workspaceId: ctx.workspaceId,
        type: "EXPENSE",
        status: "SETTLED",
        description: `Quitação: ${plan.description}`,
        notes: `Saldo devedor ${outstanding.toFixed(2)} · pago ${toMoney(input.amount).toFixed(2)}`,
        amount: toMoney(input.amount).toFixed(2),
        date: toDbDate(input.date),
        dueDate: toDbDate(input.date),
        settledAt: toDbDate(input.date),
        accountId: input.accountId,
        categoryId: plan.categoryId,
        nature: "VARIABLE",
      },
    });
    await tx.installmentPlan.update({ where: { id: plan.id }, data: { status: "SETTLED_EARLY" } });
    await audit(tx, ctx, {
      action: "installments.settleEarly",
      entityType: "InstallmentPlan",
      entityId: plan.id,
      after: { outstanding: outstanding.toFixed(2), paid: input.amount },
    });
  });
}

/** Exclui a compra: remove as parcelas pendentes (pagas e de faturas pagas ficam, como histórico). */
export async function deleteInstallmentPlan(ctx: ServiceContext, planId: string, today: ISODate) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.findFirst({
      where: { id: planId, workspaceId: ctx.workspaceId, deletedAt: null },
    });
    if (!plan) throw new AppError("NOT_FOUND");
    const removable = await tx.transaction.findMany({
      where: {
        installmentPlanId: plan.id,
        status: { not: "SETTLED" },
        OR: [{ invoiceId: null }, { invoice: { status: { not: "PAID" } } }],
      },
      select: { id: true, invoiceId: true },
    });
    await tx.attachment.deleteMany({
      where: { transactionId: { in: removable.map((r) => r.id) } },
    });
    await tx.transaction.deleteMany({ where: { id: { in: removable.map((r) => r.id) } } });
    for (const inv of new Set(
      removable.map((r) => r.invoiceId).filter((x): x is string => Boolean(x)),
    ))
      await refreshInvoiceStatus(tx, inv, today);
    const left = await tx.transaction.count({ where: { installmentPlanId: plan.id } });
    if (left === 0) await tx.installmentPlan.delete({ where: { id: plan.id } });
    else
      await tx.installmentPlan.update({
        where: { id: plan.id },
        data: { deletedAt: new Date(), status: "CANCELED" },
      });
    await audit(tx, ctx, {
      action: "installments.delete",
      entityType: "InstallmentPlan",
      entityId: plan.id,
      before: plan,
    });
  });
}

/** Planos ativos cujas parcelas acabaram viram "concluídos" (chamado nas leituras e no job). */
export async function finishCompletedPlans(workspaceId?: string): Promise<number> {
  const result = await prisma.installmentPlan.updateMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      status: "ACTIVE",
      deletedAt: null,
      installments: { none: { status: "PENDING", deletedAt: null } },
    },
    data: { status: "FINISHED" },
  });
  return result.count;
}
