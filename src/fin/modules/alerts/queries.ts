import type { NotificationPriority } from "@prisma/client";
import { prisma } from "@fin/lib/db";
import type { ServiceContext } from "@fin/lib/permissions";
import { PRIORITY_ORDER } from "./service";

export interface AlertDTO {
  id: string;
  code: string;
  priority: NotificationPriority;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

/** Alertas visíveis: não dispensados e não adiados, do mais grave ao menos grave. */
export async function listAlerts(
  ctx: ServiceContext,
  opts: { limit?: number } = {},
): Promise<AlertDTO[]> {
  const rows = await prisma.notification.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      dismissedAt: null,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, opts.limit ?? 200)
    .map((r) => ({
      id: r.id,
      code: r.code,
      priority: r.priority,
      title: r.title,
      body: r.body,
      href: r.href,
      read: r.readAt !== null,
      createdAt: r.createdAt.toISOString(),
    }));
}

export async function alertCounts(ctx: ServiceContext) {
  const alerts = await listAlerts(ctx);
  return {
    unread: alerts.filter((a) => !a.read).length,
    top: alerts[0]?.priority ?? null,
  };
}
