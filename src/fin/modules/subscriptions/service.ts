import { audit } from "@fin/lib/audit";
import { type ISODate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { getOwnedCard } from "@fin/modules/credit-cards/service";
import {
  applyTemplateToSeries,
  createRecurrence,
  endSeries,
  setPaused,
} from "@fin/modules/recurrences/service";
import type { RepeatInput } from "@fin/modules/recurrences/schemas";
import type { SubscriptionInput } from "./schemas";

const BILLING: Record<
  SubscriptionInput["billing"],
  Pick<RepeatInput, "frequency" | "intervalCount">
> = {
  MONTHLY: { frequency: "MONTHLY", intervalCount: 1 },
  QUARTERLY: { frequency: "MONTHLY", intervalCount: 3 },
  SEMIANNUAL: { frequency: "MONTHLY", intervalCount: 6 },
  YEARLY: { frequency: "YEARLY", intervalCount: 1 },
};

/** Assinatura = metadados sobre uma série de despesa (fixa) que gera as cobranças. */
export async function createSubscription(
  ctx: ServiceContext,
  input: SubscriptionInput,
  today: ISODate,
) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, workspaceId: ctx.workspaceId, kind: "EXPENSE" },
    });
    if (!category) throw new AppError("CATEGORY_KIND_MISMATCH");
    if (input.creditCardId) await getOwnedCard(tx, ctx, input.creditCardId);
    else if (
      input.accountId &&
      !(await tx.account.findFirst({
        where: { id: input.accountId, workspaceId: ctx.workspaceId },
      }))
    ) {
      throw new AppError("NOT_FOUND", "Conta não encontrada.");
    }
    const recurrence = await createRecurrence(
      tx,
      ctx,
      {
        type: "EXPENSE",
        description: input.name,
        amount: input.amount,
        categoryId: category.id,
        accountId: input.creditCardId ? null : input.accountId,
        creditCardId: input.creditCardId,
        paymentMethod: input.creditCardId ? "CREDIT_CARD" : "AUTO_DEBIT",
        nature: "FIXED",
      },
      {
        ...BILLING[input.billing],
        dayRule: "FIXED_DAY",
        dayOfMonth: null,
        nonBusinessDayShift: "NONE",
        endMode: "never",
        endDate: null,
        maxOccurrences: null,
        isEstimatedAmount: false,
      },
      input.nextChargeDate,
      today,
    );
    const subscription = await tx.subscription.create({
      data: {
        workspaceId: ctx.workspaceId,
        recurrenceId: recurrence.id,
        name: input.name,
        provider: input.provider,
        website: input.website,
        startedAt: toDbDate(input.nextChargeDate),
        trialEndsAt: input.trialEndsAt ? toDbDate(input.trialEndsAt) : null,
        notes: input.notes,
      },
    });
    await audit(tx, ctx, {
      action: "subscription.create",
      entityType: "Subscription",
      entityId: subscription.id,
      after: subscription,
    });
    return subscription;
  });
}

async function getOwned(ctx: ServiceContext, id: string) {
  const s = await prisma.subscription.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { recurrence: true },
  });
  if (!s) throw new AppError("NOT_FOUND");
  return s;
}

/** Reajuste: novo valor a partir de uma data; cobranças anteriores não mudam. */
export async function changeSubscriptionAmount(
  ctx: ServiceContext,
  id: string,
  amount: string,
  fromDate: ISODate,
) {
  assertCan(ctx, "write");
  const s = await getOwned(ctx, id);
  await prisma.$transaction(async (tx) => {
    const r = s.recurrence;
    await applyTemplateToSeries(
      tx,
      ctx,
      r,
      {
        type: "EXPENSE",
        description: r.description,
        amount,
        categoryId: r.categoryId,
        accountId: r.accountId,
        creditCardId: r.creditCardId,
        paymentMethod: r.paymentMethod,
        nature: r.nature,
      },
      fromDate,
    );
  });
}

export async function setSubscriptionStatus(
  ctx: ServiceContext,
  id: string,
  status: "ACTIVE" | "PAUSED" | "CANCELED",
  today: ISODate,
) {
  assertCan(ctx, "write");
  const s = await getOwned(ctx, id);
  if (s.status === "CANCELED" && status !== "CANCELED")
    throw new AppError(
      "VALIDATION",
      "Assinatura cancelada não pode ser reativada. Cadastre de novo.",
    );
  if (status === "PAUSED") await setPaused(ctx, s.recurrenceId, true, today);
  if (status === "ACTIVE" && s.status === "PAUSED")
    await setPaused(ctx, s.recurrenceId, false, today);
  if (status === "CANCELED") {
    await prisma.$transaction(async (tx) => {
      // Cancelar: cobranças futuras pendentes somem; histórico fica.
      await endSeries(tx, ctx, s.recurrence, today);
    });
  }
  await prisma.subscription.update({
    where: { id },
    data: { status, canceledAt: status === "CANCELED" ? toDbDate(today) : null },
  });
  await audit(prisma, ctx, {
    action: `subscription.${status.toLowerCase()}`,
    entityType: "Subscription",
    entityId: id,
  });
}
