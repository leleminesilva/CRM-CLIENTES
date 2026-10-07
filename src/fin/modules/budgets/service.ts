import { audit } from "@fin/lib/audit";
import { addMonthsToKey, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import type { SetBudgetInput } from "./schemas";

const first = (month: string) => toDbDate(`${month}-01`);

/**
 * Define o limite de uma categoria a partir de um mês (vigência): o limite anterior termina no mês
 * anterior e meses passados não são reescritos. Redefinir no mesmo mês substitui o limite.
 */
export async function setBudget(ctx: ServiceContext, input: SetBudgetInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: input.categoryId, workspaceId: ctx.workspaceId, kind: "EXPENSE" },
    });
    if (!category) throw new AppError("NOT_FOUND", "Categoria de despesa não encontrada.");
    if (category.archivedAt) throw new AppError("CATEGORY_ARCHIVED");
    const from = first(input.fromMonth);
    // Encerra o limite vigente (que começou antes) no mês anterior.
    await tx.budget.updateMany({
      where: {
        categoryId: category.id,
        effectiveFrom: { lt: from },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      data: { effectiveTo: first(addMonthsToKey(input.fromMonth, -1)) },
    });
    // Limites futuros que começariam depois deste ficam substituídos por este (a escolha mais recente vence).
    await tx.budget.deleteMany({ where: { categoryId: category.id, effectiveFrom: { gt: from } } });
    const budget = await tx.budget.upsert({
      where: { categoryId_effectiveFrom: { categoryId: category.id, effectiveFrom: from } },
      create: {
        workspaceId: ctx.workspaceId,
        categoryId: category.id,
        amount: input.amount,
        effectiveFrom: from,
        alertThresholdPercent: input.alertThresholdPercent,
      },
      update: {
        amount: input.amount,
        effectiveTo: null,
        alertThresholdPercent: input.alertThresholdPercent,
      },
    });
    await audit(tx, ctx, {
      action: "budget.set",
      entityType: "Budget",
      entityId: budget.id,
      after: { category: category.name, amount: input.amount, from: input.fromMonth },
    });
    return budget;
  });
}

/** Remove o limite a partir de um mês (meses anteriores continuam com o limite que tinham). */
export async function removeBudget(ctx: ServiceContext, categoryId: string, fromMonth: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { id: categoryId, workspaceId: ctx.workspaceId },
    });
    if (!category) throw new AppError("NOT_FOUND");
    const from = first(fromMonth);
    await tx.budget.deleteMany({ where: { categoryId, effectiveFrom: { gte: from } } });
    await tx.budget.updateMany({
      where: {
        categoryId,
        effectiveFrom: { lt: from },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      data: { effectiveTo: first(addMonthsToKey(fromMonth, -1)) },
    });
    await audit(tx, ctx, {
      action: "budget.remove",
      entityType: "Budget",
      after: { category: category.name, from: fromMonth },
    });
  });
}
