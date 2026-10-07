import { prisma } from "@fin/lib/db";
import type { ServiceContext } from "@fin/lib/permissions";
import type { ImportBatchDTO } from "./types";

export async function listImports(ctx: ServiceContext): Promise<ImportBatchDTO[]> {
  const batches = await prisma.importBatch.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const live = await prisma.transaction.groupBy({
    by: ["importBatchId"],
    where: { importBatchId: { in: batches.map((b) => b.id) }, deletedAt: null },
    _count: true,
  });
  const counts = new Map(live.map((l) => [l.importBatchId, l._count]));
  return batches.map((b) => {
    const s = (b.stats ?? {}) as { read?: number; imported?: number; duplicates?: number };
    return {
      id: b.id,
      source: b.source,
      fileName: b.fileName,
      accountName: b.account?.name ?? null,
      status: b.status,
      stats: { read: s.read ?? 0, imported: s.imported ?? 0, duplicates: s.duplicates ?? 0 },
      liveCount: counts.get(b.id) ?? 0,
      createdAt: b.createdAt.toISOString(),
    };
  });
}
