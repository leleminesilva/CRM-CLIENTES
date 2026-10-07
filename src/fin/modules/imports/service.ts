import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { fromDbDate, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import { normalizeText } from "@fin/modules/search/domain/normalize";
import { parseDelimited } from "./domain/csv";
import { parseOfx } from "./domain/ofx";
import { rowsFromTable } from "./domain/table";
import type { ParseOutcome } from "./domain/types";
import { MAX_IMPORT_ROWS, type CommitImportInput, type PreviewImportInput } from "./schemas";
import type { ImportPreview, PreviewRow } from "./types";

async function xlsxToTable(base64: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Buffer.from(base64, "base64") as unknown as ArrayBuffer);
  } catch {
    throw new AppError(
      "VALIDATION",
      "Não foi possível ler a planilha. Envie um arquivo .xlsx válido.",
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new AppError("VALIDATION", "A planilha não tem nenhuma aba.");
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) {
      const v = row.getCell(c).value;
      if (v instanceof Date) cells.push(v.toISOString().slice(0, 10));
      else if (typeof v === "number") cells.push(String(Math.round(v * 100) / 100));
      else if (v && typeof v === "object" && "result" in v) cells.push(String(v.result ?? ""));
      else if (v && typeof v === "object" && "text" in v) cells.push(String(v.text));
      else cells.push(v === null || v === undefined ? "" : String(v));
    }
    table.push(cells);
  });
  return table;
}

function parseContent(input: PreviewImportInput, table?: string[][]): ParseOutcome {
  if (input.source === "OFX") return parseOfx(input.content);
  const result = rowsFromTable(table ?? parseDelimited(input.content), input.invertSign);
  if (!result.headerFound)
    throw new AppError(
      "VALIDATION",
      "Não reconhecemos as colunas. A primeira linha precisa ter Data, Descrição e Valor (ou Débito e Crédito).",
    );
  return result;
}

async function assertAccount(ctx: ServiceContext, accountId: string) {
  const account = await prisma.account.findFirst({
    where: { id: accountId, workspaceId: ctx.workspaceId },
    select: { id: true, archivedAt: true },
  });
  if (!account) throw new AppError("NOT_FOUND");
  if (account.archivedAt) throw new AppError("ACCOUNT_ARCHIVED");
}

interface Candidate {
  date: string;
  description: string;
  amount: string;
  externalId: string | null;
}

/** Marca o que já existe na conta: pelo identificador do banco ou por data + valor + descrição. */
async function findDuplicates(
  ctx: ServiceContext,
  accountId: string,
  rows: Candidate[],
): Promise<Map<number, "id" | "match">> {
  const result = new Map<number, "id" | "match">();
  if (rows.length === 0) return result;
  const dates = rows.map((r) => r.date).sort();
  const existing = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      accountId,
      deletedAt: null,
      OR: [
        { dueDate: { gte: toDbDate(dates[0]!), lte: toDbDate(dates.at(-1)!) } },
        { externalId: { in: rows.map((r) => r.externalId).filter((x): x is string => !!x) } },
      ],
    },
    select: { externalId: true, dueDate: true, amount: true, description: true, type: true },
  });
  const ids = new Set(existing.map((e) => e.externalId).filter((x): x is string => !!x));
  // Consome o que já existe: duas compras iguais no arquivo só duplicam se houver duas no banco.
  const pool = new Map<string, number>();
  for (const e of existing) {
    const sign = e.type === "INCOME" || e.type === "REFUND" ? "" : "-";
    const key = `${fromDbDate(e.dueDate)}|${sign}${e.amount.toFixed(2)}|${normalizeText(e.description)}`;
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  rows.forEach((r, i) => {
    if (r.externalId && ids.has(r.externalId)) return void result.set(i, "id");
    const key = `${r.date}|${r.amount}|${normalizeText(r.description)}`;
    const left = pool.get(key) ?? 0;
    if (left > 0) {
      pool.set(key, left - 1);
      result.set(i, "match");
    }
  });
  return result;
}

/** Lê o arquivo e mostra o que seria importado. Não grava nada. */
export async function previewImport(
  ctx: ServiceContext,
  input: PreviewImportInput,
): Promise<ImportPreview> {
  assertCan(ctx, "write");
  await assertAccount(ctx, input.accountId);
  const table = input.source === "XLSX" ? await xlsxToTable(input.content) : undefined;
  const parsed = parseContent(input, table);
  if (parsed.rows.length > MAX_IMPORT_ROWS)
    throw new AppError(
      "VALIDATION",
      `O arquivo tem linhas demais (máximo ${MAX_IMPORT_ROWS}). Divida por período.`,
    );

  const dups = await findDuplicates(ctx, input.accountId, parsed.rows);
  const descriptions = [...new Set(parsed.rows.map((r) => r.description))];
  const history = await prisma.transaction.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      description: { in: descriptions },
      categoryId: { not: null },
      type: { in: ["INCOME", "EXPENSE"] },
    },
    select: { description: true, type: true, categoryId: true },
    orderBy: { date: "desc" },
  });
  const suggestion = new Map<string, string>();
  for (const h of history) {
    const key = `${h.type}|${h.description}`;
    if (!suggestion.has(key)) suggestion.set(key, h.categoryId!);
  }

  const rows: PreviewRow[] = parsed.rows.map((r, i) => {
    const type = r.amount.startsWith("-") ? "EXPENSE" : "INCOME";
    return {
      ...r,
      type,
      duplicate: dups.has(i),
      duplicateReason: dups.get(i) ?? null,
      categoryId: suggestion.get(`${type}|${r.description}`) ?? null,
    };
  });
  const duplicates = rows.filter((r) => r.duplicate).length;
  return {
    rows,
    errors: parsed.errors,
    stats: {
      read: rows.length + parsed.errors.length,
      fresh: rows.length - duplicates,
      duplicates,
      errors: parsed.errors.length,
    },
  };
}

/** Grava as linhas escolhidas como lançamentos já liquidados, num lote que pode ser desfeito. */
export async function commitImport(ctx: ServiceContext, input: CommitImportInput) {
  assertCan(ctx, "write");
  await assertAccount(ctx, input.accountId);
  const categoryIds = [
    ...new Set(input.rows.map((r) => r.categoryId).filter((x): x is string => !!x)),
  ];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, workspaceId: ctx.workspaceId },
    select: { id: true, kind: true, archivedAt: true, defaultNature: true },
  });
  const byId = new Map(categories.map((c) => [c.id, c]));

  for (const r of input.rows) {
    const type = r.amount.startsWith("-") ? "EXPENSE" : "INCOME";
    if (r.categoryId) {
      const cat = byId.get(r.categoryId);
      if (!cat) throw new AppError("NOT_FOUND", "Uma das categorias escolhidas não existe mais.");
      if (cat.archivedAt) throw new AppError("CATEGORY_ARCHIVED");
      if (cat.kind !== type) throw new AppError("CATEGORY_KIND_MISMATCH");
    }
  }

  return prisma.$transaction(async (tx) => {
    // Revalida os duplicados no servidor: a prévia pode ter ficado aberta enquanto algo foi lançado.
    const dups = await findDuplicates(ctx, input.accountId, input.rows);
    const fresh = input.rows.filter((_, i) => !dups.has(i));
    if (fresh.length === 0)
      throw new AppError("CONFLICT", "Todas as linhas escolhidas já existem nesta conta.");
    const batch = await tx.importBatch.create({
      data: {
        workspaceId: ctx.workspaceId,
        source: input.source,
        fileName: input.fileName || null,
        accountId: input.accountId,
        status: "COMMITTED",
        committedAt: new Date(),
        stats: { read: input.rows.length, imported: fresh.length, duplicates: dups.size },
      },
    });
    await tx.transaction.createMany({
      data: fresh.map((r) => {
        const expense = r.amount.startsWith("-");
        return {
          workspaceId: ctx.workspaceId,
          type: expense ? ("EXPENSE" as const) : ("INCOME" as const),
          status: "SETTLED" as const,
          description: r.description,
          amount: new Prisma.Decimal(r.amount).abs(),
          date: toDbDate(r.date),
          dueDate: toDbDate(r.date),
          settledAt: toDbDate(r.date),
          accountId: input.accountId,
          categoryId: r.categoryId,
          nature: expense ? (byId.get(r.categoryId ?? "")?.defaultNature ?? "VARIABLE") : null,
          importBatchId: batch.id,
          externalId: r.externalId,
        };
      }),
    });
    await audit(tx, ctx, {
      action: "import.commit",
      entityType: "ImportBatch",
      entityId: batch.id,
      after: { source: input.source, imported: fresh.length, duplicates: dups.size },
    });
    return { batchId: batch.id, imported: fresh.length, skippedDuplicates: dups.size };
  });
}

/** Desfaz o lote: os lançamentos vão para a lixeira (restauráveis) e o lote fica como revertido. */
export async function rollbackImport(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!batch) throw new AppError("NOT_FOUND");
    if (batch.status !== "COMMITTED")
      throw new AppError("CONFLICT", "Esta importação já foi desfeita.");
    const { count } = await tx.transaction.updateMany({
      where: { importBatchId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await tx.importBatch.update({ where: { id }, data: { status: "ROLLED_BACK" } });
    await audit(tx, ctx, {
      action: "import.rollback",
      entityType: "ImportBatch",
      entityId: id,
      after: { removed: count },
    });
    return { removed: count };
  });
}
