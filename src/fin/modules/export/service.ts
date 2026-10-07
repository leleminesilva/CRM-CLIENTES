import JSZip from "jszip";
import { prisma } from "@fin/lib/db";
import type { ServiceContext } from "@fin/lib/permissions";
import { storage } from "@fin/lib/storage";

export const EXPORT_VERSION = 1;

/** Decimal → "1234.56", Date → ISO, BigInt → texto. O arquivo é legível sem o app. */
function replacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

export interface WorkspaceExport {
  formatVersion: number;
  exportedAt: string;
  workspace: { id: string; name: string };
  counts: Record<string, number>;
  data: Record<string, unknown[]>;
}

/** Todos os dados do workspace ativo, prontos para serem guardados ou levados para outro sistema. */
export async function buildWorkspaceExport(ctx: ServiceContext): Promise<WorkspaceExport> {
  const where = { workspaceId: ctx.workspaceId };
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: ctx.workspaceId },
    select: { id: true, name: true },
  });
  const entries: [string, Promise<unknown[]>][] = [
    ["accounts", prisma.account.findMany({ where })],
    ["categories", prisma.category.findMany({ where })],
    ["transactions", prisma.transaction.findMany({ where, orderBy: { date: "asc" } })],
    ["recurrences", prisma.recurrence.findMany({ where })],
    ["subscriptions", prisma.subscription.findMany({ where })],
    ["commissions", prisma.commission.findMany({ where })],
    ["creditCards", prisma.creditCard.findMany({ where })],
    ["creditCardInvoices", prisma.creditCardInvoice.findMany({ where })],
    ["installmentPlans", prisma.installmentPlan.findMany({ where })],
    ["budgets", prisma.budget.findMany({ where })],
    ["goals", prisma.goal.findMany({ where })],
    ["goalContributions", prisma.goalContribution.findMany({ where: { goal: where } })],
    ["assets", prisma.asset.findMany({ where })],
    ["assetValuations", prisma.assetValuation.findMany({ where: { asset: where } })],
    ["liabilities", prisma.liability.findMany({ where })],
    ["financialSnapshots", prisma.financialSnapshot.findMany({ where })],
    ["attachments", prisma.attachment.findMany({ where })],
    ["importBatches", prisma.importBatch.findMany({ where })],
  ];
  const results = await Promise.all(entries.map(([, p]) => p));
  const data = Object.fromEntries(entries.map(([name], i) => [name, results[i]!]));
  return {
    formatVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    data,
  };
}

export function exportToJson(payload: WorkspaceExport): string {
  return JSON.stringify(payload, replacer, 2);
}

/** ZIP com o JSON e os anexos do workspace (pasta anexos/). Anexos ausentes no disco são listados. */
export async function buildExportZip(ctx: ServiceContext): Promise<Buffer> {
  const payload = await buildWorkspaceExport(ctx);
  const zip = new JSZip();
  zip.file("dados.json", exportToJson(payload));
  const attachments = (payload.data.attachments ?? []) as {
    id: string;
    fileName: string;
    storageKey: string;
  }[];
  const missing: string[] = [];
  for (const a of attachments) {
    try {
      zip.file(
        `anexos/${a.id}-${a.fileName.replace(/[\\/:*?"<>|]/g, "_")}`,
        await storage().get(a.storageKey),
      );
    } catch {
      missing.push(`${a.id} ${a.fileName}`);
    }
  }
  if (missing.length > 0) zip.file("anexos-ausentes.txt", missing.join("\n"));
  zip.file(
    "LEIA-ME.txt",
    [
      "Exportação do Controle de Gasto",
      `Workspace: ${payload.workspace.name}`,
      `Gerada em: ${payload.exportedAt}`,
      "",
      'dados.json: todas as entidades do workspace. Valores em reais como texto ("1234.56"), datas em ISO.',
      "anexos/: comprovantes e notas, nomeados por <id>-<arquivo> (o id está em attachments).",
      "Para uma cópia que restaura o sistema inteiro, use Configurações > Dados e backup.",
    ].join("\n"),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
