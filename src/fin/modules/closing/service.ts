import { audit } from "@fin/lib/audit";
import { monthKeyOf, type ISODate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { liveSummary } from "./queries";

/** Fecha o mês: congela os totais do dia e registra as observações. Não bloqueia edições. */
export async function closeMonth(
  ctx: ServiceContext,
  month: string,
  notes: string | null,
  today: ISODate,
) {
  assertCan(ctx, "write");
  if (month > monthKeyOf(today))
    throw new AppError("VALIDATION", "Não dá para fechar um mês que ainda não começou.");
  const summary = await liveSummary(ctx, month, today);
  try {
    const created = await prisma.monthClose.create({
      data: {
        workspaceId: ctx.workspaceId,
        month,
        notes: notes || null,
        closedById: ctx.userId,
        summary: { ...summary },
      },
    });
    await audit(prisma, ctx, {
      action: "month.close",
      entityType: "MonthClose",
      entityId: created.id,
      after: { month, ...summary },
    });
    return created;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new AppError("CONFLICT", "Este mês já foi fechado.");
    throw error;
  }
}

export async function reopenMonth(ctx: ServiceContext, month: string) {
  assertCan(ctx, "manage");
  const existing = await prisma.monthClose.findUnique({
    where: { workspaceId_month: { workspaceId: ctx.workspaceId, month } },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Este mês não está fechado.");
  await prisma.monthClose.delete({ where: { id: existing.id } });
  await audit(prisma, ctx, {
    action: "month.reopen",
    entityType: "MonthClose",
    entityId: existing.id,
    before: { month },
  });
}
