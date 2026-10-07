import { Prisma, type CategoryKind, type ExpenseNature, type TransactionType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ensureFuelCategory } from "@fin/crm/combustivel";
import { ensureBusinessWorkspace } from "@fin/lib/workspace";
import {
  ACCOUNT_TYPE,
  KIND,
  categoryAttributes,
  isoToDbDate,
  legacyDateToISO,
  normalizeColor,
  uniqueName,
} from "./caixa-map";

// Cópia do Caixa antigo (financeiro_contas/categorias/lancamentos) para o Financeiro novo (fin_*).
// - Só lê as tabelas antigas: Caixa e Carros continuam intactos.
// - Repetível: cada linha nova guarda o id de origem (legacyId). Rodar de novo atualiza o que
//   mudou, cria o que entrou e manda para a lixeira o que foi excluído no antigo.
// - Tudo numa transação: ou copia tudo, ou nada. A simulação executa de verdade e desfaz no
//   final, então as regras do banco (CHECKs, únicos) também são conferidas nela.

type Tx = Prisma.TransactionClient;

export interface Counts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface CaixaReport {
  applied: boolean;
  workspaceId: string;
  accounts: Counts;
  categories: Counts & { adopted: number };
  /** fuelAlreadyInNew: gasolina já lançada direto no Financeiro novo (depois da troca): não copiada. */
  transactions: Counts & { trashed: number; skipped: number; fuelAlreadyInNew: number };
  /** Saldo de cada conta no Caixa antigo × no Financeiro novo (mesma consulta das telas novas). */
  balances: { account: string; legacy: string; migrated: string; ok: boolean }[];
  /** Usos de carro com gasolina que têm a despesa no Financeiro novo (fin_transactions.car_use_id). */
  fuel: { usesWithFuel: number; linked: number; amountMismatch: number };
  warnings: string[];
}

class DryRunRollback extends Error {}

const zeroCounts = (): Counts => ({ created: 0, updated: 0, unchanged: 0 });

function norm(value: unknown): string {
  if (value instanceof Prisma.Decimal) return value.toFixed(2);
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value ?? null);
}

function changed(current: Record<string, unknown>, desired: Record<string, unknown>): boolean {
  return Object.keys(desired).some((key) => norm(current[key]) !== norm(desired[key]));
}

export async function migrateCaixa({ apply }: { apply: boolean }): Promise<CaixaReport> {
  const workspace = await ensureBusinessWorkspace();
  let report: CaixaReport | undefined;
  try {
    await prisma.$transaction(
      async (tx) => {
        report = await run(tx, workspace.id);
        report.applied = apply;
        if (!apply) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }
  return report!;
}

async function run(tx: Tx, workspaceId: string): Promise<CaixaReport> {
  const warnings: string[] = [];

  const contas = await tx.financeiroConta.findMany({ orderBy: { createdAt: "asc" } });
  const categorias = await tx.financeiroCategoria.findMany({ orderBy: { createdAt: "asc" } });
  const lancamentos = await tx.financeiroLancamento.findMany({
    orderBy: [{ data: "asc" }, { createdAt: "asc" }],
  });

  // ── Contas ──
  const earliestByConta = new Map<string, string>();
  for (const l of lancamentos) {
    const day = legacyDateToISO(l.data);
    const known = earliestByConta.get(l.contaId);
    if (!known || day < known) earliestByConta.set(l.contaId, day);
  }

  const accounts = zeroCounts();
  const existingAccounts = await tx.account.findMany({ where: { workspaceId } });
  const accountId = new Map<string, string>();

  for (const conta of contas) {
    const current = existingAccounts.find((a) => a.legacyId === conta.id);
    const taken = new Set(
      existingAccounts.filter((a) => a.id !== current?.id).map((a) => a.name.toLowerCase()),
    );
    // O saldo novo só soma lançamentos pagos a partir desta data: ela não pode ser
    // posterior ao lançamento mais antigo da conta.
    const createdDay = legacyDateToISO(conta.createdAt);
    const earliest = earliestByConta.get(conta.id);
    const startDay = earliest && earliest < createdDay ? earliest : createdDay;

    const desired = {
      name: uniqueName(conta.nome, taken),
      type: ACCOUNT_TYPE[conta.tipo],
      institution: conta.instituicao ?? null,
      initialBalance: conta.saldoInicial,
      initialBalanceDate: isoToDbDate(startDay),
      color: normalizeColor(conta.cor),
      archivedAt: conta.ativa ? null : (current?.archivedAt ?? conta.updatedAt),
    };

    if (conta.tipo === "CARTAO") {
      warnings.push(
        `Conta "${conta.nome}" era do tipo Cartão: virou conta "Outro". Cartões de crédito no Financeiro novo têm cadastro próprio.`,
      );
    }
    if (conta.origem === "OPEN_FINANCE" || conta.pluggyAccountId) {
      warnings.push(
        `Conta "${conta.nome}" vinha do Open Finance: os lançamentos foram copiados, a sincronização automática não.`,
      );
    }
    if (desired.name !== conta.nome.trim()) {
      warnings.push(`Conta "${conta.nome}" já existia com esse nome: copiada como "${desired.name}".`);
    }

    if (!current) {
      const created = await tx.account.create({
        data: { workspaceId, legacyId: conta.id, ...desired, createdAt: conta.createdAt },
      });
      existingAccounts.push(created);
      accountId.set(conta.id, created.id);
      accounts.created++;
    } else if (changed(current, desired)) {
      const updated = await tx.account.update({ where: { id: current.id }, data: desired });
      existingAccounts.splice(existingAccounts.indexOf(current), 1, updated);
      accountId.set(conta.id, current.id);
      accounts.updated++;
    } else {
      accountId.set(conta.id, current.id);
      accounts.unchanged++;
    }
  }

  // ── Categorias ──
  const categories = { ...zeroCounts(), adopted: 0 };
  const existingCategories = await tx.category.findMany({ where: { workspaceId } });
  const categoryOf = new Map<
    string,
    { id: string; kind: CategoryKind; defaultNature: ExpenseNature | null }
  >();
  const sortByKind: Record<CategoryKind, number> = { INCOME: 0, EXPENSE: 0 };

  for (const cat of categorias) {
    const attrs = categoryAttributes(cat.nome, cat.tipo, cat.cor);
    let current = existingCategories.find((c) => c.legacyId === cat.id);
    let adopted = false;

    if (!current) {
      // Já existe uma categoria igual no Financeiro novo (ex.: criada à mão): usa ela em vez de
      // duplicar — o nome é único por nível, sem diferenciar maiúsculas.
      const twin = existingCategories.find(
        (c) =>
          !c.legacyId &&
          c.parentId === null &&
          !c.archivedAt &&
          c.kind === attrs.kind &&
          c.name.toLowerCase() === attrs.name.toLowerCase(),
      );
      if (twin) {
        current = await tx.category.update({ where: { id: twin.id }, data: { legacyId: cat.id } });
        existingCategories.splice(existingCategories.indexOf(twin), 1, current);
        categories.adopted++;
        adopted = true;
      }
    }

    if (!current) {
      const created = await tx.category.create({
        data: {
          workspaceId,
          legacyId: cat.id,
          ...attrs,
          sortOrder: sortByKind[attrs.kind]++,
          createdAt: cat.createdAt,
        },
      });
      existingCategories.push(created);
      categoryOf.set(cat.id, created);
      categories.created++;
      continue;
    }

    // Numa nova rodada só o que vem do antigo é atualizado (nome e cor): ícone, classe e
    // natureza podem ter sido ajustados no Financeiro novo e não são sobrescritos.
    const desired = { name: attrs.name, color: attrs.color };
    if (changed(current, desired)) {
      current = await tx.category.update({ where: { id: current.id }, data: desired });
      if (!adopted) categories.updated++;
    } else if (!adopted) {
      categories.unchanged++;
    }
    categoryOf.set(cat.id, current);
  }

  // A "Combustível" vira categoria de sistema: a gasolina dos carros passa a lançar nela.
  await ensureFuelCategory(tx, workspaceId);

  // ── Lançamentos ──
  const transactions = { ...zeroCounts(), trashed: 0, skipped: 0, fuelAlreadyInNew: 0 };
  // Gasolina dos carros: lançamento antigo → uso de carro, para ligar a cópia ao uso.
  const usoPorLancamento = new Map(
    (
      await tx.financeiroCarroUso.findMany({
        where: { lancamentoCombustivelId: { not: null } },
        select: { id: true, lancamentoCombustivelId: true },
      })
    ).map((u) => [u.lancamentoCombustivelId!, u.id]),
  );
  // Usos cuja gasolina já foi lançada direto no Financeiro novo (correção feita depois da troca).
  const lancadoNoNovo = new Set(
    (
      await tx.transaction.findMany({
        where: { workspaceId, carUseId: { not: null }, legacyId: null },
        select: { carUseId: true },
      })
    ).map((t) => t.carUseId!),
  );
  const existingTransactions = await tx.transaction.findMany({
    where: { workspaceId, legacyId: { not: null } },
  });
  const transactionByLegacy = new Map(existingTransactions.map((t) => [t.legacyId!, t]));
  const seen = new Set<string>();
  const auditEntries: Prisma.FinAuditLogCreateManyInput[] = [];

  for (const l of lancamentos) {
    seen.add(l.id);
    const carUseId = usoPorLancamento.get(l.id) ?? null;
    if (carUseId && lancadoNoNovo.has(carUseId)) {
      transactions.fuelAlreadyInNew++;
      continue;
    }
    if (l.valor.lte(0)) {
      warnings.push(`Lançamento "${l.descricao}" (${l.id}) com valor ${l.valor.toFixed(2)}: não copiado.`);
      transactions.skipped++;
      continue;
    }
    const type: TransactionType = KIND[l.tipo] === "INCOME" ? "INCOME" : "EXPENSE";
    let category = l.categoriaId ? categoryOf.get(l.categoriaId) : undefined;
    if (category && category.kind !== KIND[l.tipo]) {
      warnings.push(
        `Lançamento "${l.descricao}" (${l.id}) estava numa categoria de outro tipo: copiado sem categoria.`,
      );
      category = undefined;
    }
    const day = isoToDbDate(legacyDateToISO(l.data));
    const desired = {
      type,
      status: "SETTLED" as const,
      description: l.descricao,
      amount: l.valor,
      date: day,
      dueDate: day,
      settledAt: day,
      accountId: accountId.get(l.contaId)!,
      categoryId: category?.id ?? null,
      nature: type === "EXPENSE" ? (category?.defaultNature ?? null) : null,
      externalId: l.pluggyTransactionId ?? null,
      carUseId,
      deletedAt: null,
    };

    const current = transactionByLegacy.get(l.id);
    if (!current) {
      const created = await tx.transaction.create({
        data: { workspaceId, legacyId: l.id, ...desired, createdAt: l.createdAt },
      });
      // Quem lançou no Caixa antigo fica registrado na auditoria do Financeiro novo.
      auditEntries.push({
        workspaceId,
        userId: l.criadoPorId,
        action: "transaction.create",
        entityType: "Transaction",
        entityId: created.id,
        changes: { origem: "financeiro_lancamentos", legacyId: l.id },
        createdAt: l.createdAt,
      });
      transactions.created++;
    } else if (changed(current, desired)) {
      await tx.transaction.update({ where: { id: current.id }, data: desired });
      transactions.updated++;
    } else {
      transactions.unchanged++;
    }
  }

  // Excluídos no Caixa antigo depois da última cópia: vão para a lixeira (restauráveis).
  const gone = existingTransactions.filter((t) => !seen.has(t.legacyId!) && !t.deletedAt);
  if (gone.length) {
    await tx.transaction.updateMany({
      where: { id: { in: gone.map((t) => t.id) } },
      data: { deletedAt: new Date() },
    });
    transactions.trashed = gone.length;
  }

  if (auditEntries.length) await tx.finAuditLog.createMany({ data: auditEntries });

  // ── Conferências ──
  const legacyBalance = new Map<string, Prisma.Decimal>(contas.map((c) => [c.id, c.saldoInicial]));
  for (const l of lancamentos) {
    const signed = l.tipo === "ENTRADA" ? l.valor : l.valor.neg();
    legacyBalance.set(l.contaId, legacyBalance.get(l.contaId)!.add(signed));
  }
  // Mesma regra de saldo do Financeiro novo (Financeiro/src/modules/accounts/repository.ts).
  const migratedRows = await tx.$queryRaw<{ legacy_id: string; name: string; balance: string }[]>`
    SELECT a.legacy_id, a.name,
           (a.initial_balance + COALESCE(SUM(
             CASE
               WHEN t.type IN ('INCOME','REFUND')        AND t.account_id = a.id          THEN  t.amount
               WHEN t.type IN ('EXPENSE','CARD_PAYMENT') AND t.account_id = a.id          THEN -t.amount
               WHEN t.type = 'TRANSFER'                  AND t.account_id = a.id          THEN -t.amount
               WHEN t.type = 'TRANSFER'                  AND t.transfer_account_id = a.id THEN  t.amount
             END), 0))::text AS balance
    FROM fin_accounts a
    LEFT JOIN fin_transactions t
           ON (t.account_id = a.id OR t.transfer_account_id = a.id)
          AND t.status = 'SETTLED'
          AND t.deleted_at IS NULL
          AND t.settled_at >= a.initial_balance_date
    WHERE a.workspace_id = ${workspaceId}::uuid AND a.legacy_id IS NOT NULL
    GROUP BY a.id`;
  const balances = migratedRows.map((row) => {
    const legacy = legacyBalance.get(row.legacy_id) ?? new Prisma.Decimal(0);
    const migrated = new Prisma.Decimal(row.balance);
    return {
      account: row.name,
      legacy: legacy.toFixed(2),
      migrated: migrated.toFixed(2),
      ok: legacy.eq(migrated),
    };
  });

  const usos = await tx.financeiroCarroUso.findMany({
    where: { valorCombustivel: { not: null } },
    select: {
      id: true,
      valorCombustivel: true,
      saidaEm: true,
      carro: { select: { numero: true, modelo: true } },
      motorista: { select: { nome: true } },
    },
  });
  const fuelExpenses = await tx.transaction.findMany({
    where: { workspaceId, deletedAt: null, carUseId: { in: usos.map((u) => u.id) } },
    select: { carUseId: true, amount: true },
  });
  const fuelAmount = new Map(fuelExpenses.map((t) => [t.carUseId!, t.amount]));
  let linked = 0;
  let amountMismatch = 0;
  for (const uso of usos) {
    const amount = fuelAmount.get(uso.id);
    if (!amount) {
      // Ex.: o lançamento de gasolina foi excluído no Caixa antigo; o uso ficou só com o valor.
      warnings.push(
        `Uso de carro sem despesa de gasolina no Financeiro novo: ${uso.carro.numero} · ${uso.carro.modelo} (${uso.motorista.nome}), saída em ${legacyDateToISO(uso.saidaEm)}, R$ ${uso.valorCombustivel!.toFixed(2)}.`,
      );
      continue;
    }
    linked++;
    if (uso.valorCombustivel && !amount.eq(uso.valorCombustivel)) amountMismatch++;
  }

  await tx.finAuditLog.create({
    data: {
      workspaceId,
      action: "legacy.caixa.import",
      entityType: "Workspace",
      entityId: workspaceId,
      changes: { accounts, categories, transactions } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    applied: false,
    workspaceId,
    accounts,
    categories,
    transactions,
    balances,
    fuel: { usesWithFuel: usos.length, linked, amountMismatch },
    warnings,
  };
}
