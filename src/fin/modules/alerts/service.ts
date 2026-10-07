import type { NotificationPriority } from "@prisma/client";
import type { ISODate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { logger } from "@fin/lib/logger";
import type { ServiceContext } from "@fin/lib/permissions";
import { ALERT_RULES, type AlertDraft } from "./rules";

const lastRun = new Map<string, number>();
const THROTTLE_MS = 60_000;

/**
 * Reavalia todas as regras e sincroniza a central de alertas (idempotente):
 * cria o que é novo, atualiza o texto do que continua valendo, remove o que deixou de valer.
 * Alertas dispensados não voltam enquanto a situação for a mesma (mesma chave).
 */
export async function refreshAlerts(
  ctx: ServiceContext,
  today: ISODate,
  opts: { force?: boolean } = {},
): Promise<void> {
  const key = ctx.workspaceId;
  if (!opts.force && Date.now() - (lastRun.get(key) ?? 0) < THROTTLE_MS) return;
  lastRun.set(key, Date.now());

  const drafts: AlertDraft[] = [];
  for (const rule of ALERT_RULES) {
    try {
      drafts.push(...(await rule(ctx, today)));
    } catch (error) {
      logger.error({ err: error, rule: rule.name }, "Regra de alerta falhou");
    }
  }
  const keys = new Set(drafts.map((d) => d.dedupeKey));
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: { workspaceId: ctx.workspaceId, dedupeKey: { notIn: [...keys] } },
    });
    for (const d of drafts) {
      await tx.notification.upsert({
        where: { workspaceId_dedupeKey: { workspaceId: ctx.workspaceId, dedupeKey: d.dedupeKey } },
        create: {
          workspaceId: ctx.workspaceId,
          code: d.code,
          priority: d.priority,
          title: d.title,
          body: d.body,
          href: d.href ?? null,
          entityType: d.entityType ?? null,
          entityId: d.entityId ?? null,
          dedupeKey: d.dedupeKey,
          validUntil: d.validUntil ?? null,
        },
        update: { title: d.title, body: d.body, priority: d.priority, href: d.href ?? null },
      });
    }
  });
}

/** Esquece o throttle (após mudanças que afetam alertas). */
export function invalidateAlerts(workspaceId: string) {
  lastRun.delete(workspaceId);
}

async function owned(ctx: ServiceContext, id: string) {
  const n = await prisma.notification.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!n) throw new AppError("NOT_FOUND");
  return n;
}

export async function markRead(ctx: ServiceContext, id: string) {
  await owned(ctx, id);
  await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
}

export async function markAllRead(ctx: ServiceContext) {
  await prisma.notification.updateMany({
    where: { workspaceId: ctx.workspaceId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function dismiss(ctx: ServiceContext, id: string) {
  await owned(ctx, id);
  await prisma.notification.update({
    where: { id },
    data: { dismissedAt: new Date(), readAt: new Date() },
  });
}

export async function snooze(ctx: ServiceContext, id: string, days: number) {
  await owned(ctx, id);
  await prisma.notification.update({
    where: { id },
    data: { snoozedUntil: new Date(Date.now() + days * 86_400_000), readAt: new Date() },
  });
}

export const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  CRITICAL: 0,
  IMPORTANT: 1,
  ATTENTION: 2,
  INFO: 3,
};
