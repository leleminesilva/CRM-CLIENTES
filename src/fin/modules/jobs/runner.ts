import { todayISO } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { env } from "@fin/lib/env";
import { logger } from "@fin/lib/logger";
import { closeDueInvoices } from "@fin/modules/credit-cards/service";
import { finishCompletedPlans } from "@fin/modules/installments/service";
import { captureSnapshots } from "@fin/modules/net-worth/snapshots";
import { materializeAll } from "@fin/modules/recurrences/service";
import { purgeOldTrash } from "@fin/modules/transactions/service";

const STALE_RUNNING_MS = 30 * 60 * 1000;

type JobFn = () => Promise<Record<string, unknown> | void>;

/**
 * Executa `fn` uma única vez por (name, runKey). Um job que falhou ou travou (RUNNING há mais
 * de 30 min) pode ser retomado; um job concluído nunca roda de novo para a mesma chave.
 */
export async function runOnce(
  name: string,
  runKey: string,
  fn: JobFn,
): Promise<"ran" | "skipped" | "failed"> {
  const existing = await prisma.jobRun.findUnique({ where: { name_runKey: { name, runKey } } });
  let runId: string;
  if (!existing) {
    try {
      runId = (await prisma.jobRun.create({ data: { name, runKey } })).id;
    } catch {
      return "skipped"; // outro processo pegou o mesmo job ao mesmo tempo
    }
  } else {
    const stale =
      existing.status === "RUNNING" && Date.now() - existing.startedAt.getTime() > STALE_RUNNING_MS;
    if (existing.status === "SUCCEEDED" || (existing.status === "RUNNING" && !stale))
      return "skipped";
    const claimed = await prisma.jobRun.updateMany({
      where: { id: existing.id, status: existing.status, startedAt: existing.startedAt },
      data: { status: "RUNNING", startedAt: new Date(), finishedAt: null, error: null },
    });
    if (claimed.count === 0) return "skipped";
    runId = existing.id;
  }

  try {
    const details = (await fn()) ?? undefined;
    await prisma.jobRun.update({
      where: { id: runId },
      data: { status: "SUCCEEDED", finishedAt: new Date(), details: details as object | undefined },
    });
    return "ran";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.jobRun.update({
      where: { id: runId },
      data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 2000) },
    });
    logger.error({ err: error, job: name, runKey }, "Job falhou");
    return "failed";
  }
}

/** Jobs do dia. Cada fase acrescenta os seus (recorrências, faturas, alertas, snapshots). */
export async function runDailyJobs(): Promise<Record<string, string>> {
  const today = todayISO(env.APP_TIMEZONE);
  const results: Record<string, string> = {};
  // No CRM não há backup aqui: o banco fica no Supabase, que tem backup próprio.
  results["recurrences.materialize"] = await runOnce("recurrences.materialize", today, async () =>
    materializeAll(today),
  );
  results["invoices.close"] = await runOnce("invoices.close", today, async () => ({
    closed: await closeDueInvoices(today),
    finishedPlans: await finishCompletedPlans(),
  }));
  results["snapshots.capture"] = await runOnce("snapshots.capture", today, async () => {
    const workspaces = await prisma.workspace.findMany({
      where: { isDemo: false },
      include: { members: { where: { role: "OWNER" }, take: 1 } },
    });
    let captured = 0;
    for (const w of workspaces) {
      const owner = w.members[0];
      if (owner)
        captured += await captureSnapshots(
          { userId: owner.userId, workspaceId: w.id, role: "OWNER" },
          today,
        );
    }
    return { workspaces: workspaces.length, captured };
  });
  results["trash.purge"] = await runOnce("trash.purge", today, async () => ({
    purged: await purgeOldTrash(),
  }));
  return results;
}

let inFlight: Promise<unknown> | null = null;

/** Dispara os jobs do dia em segundo plano (no máximo uma execução simultânea por processo). */
export function triggerDailyJobs(): void {
  // Na Vercel o processo morre ao fim da resposta: os jobs rodam pelo Cron (/api/cron/fin-jobs).
  if (!env.JOBS_ENABLED || process.env.VERCEL || inFlight) return;
  inFlight = runDailyJobs()
    .catch((error: unknown) => logger.error({ err: error }, "Falha ao executar os jobs diários"))
    .finally(() => {
      inFlight = null;
    });
}
