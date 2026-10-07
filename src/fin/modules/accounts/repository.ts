import { Prisma } from "@prisma/client";
import type { DbClient } from "@fin/lib/db";
import type { ISODate } from "@fin/lib/dates";
import { toDbDate } from "@fin/lib/dates";
import { toMoney } from "@fin/lib/money";
import type Decimal from "decimal.js";

export const accountRepository = {
  list(db: DbClient, workspaceId: string) {
    return db.account.findMany({
      where: { workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  },

  findById(db: DbClient, workspaceId: string, id: string) {
    return db.account.findFirst({ where: { id, workspaceId } });
  },

  findByName(db: DbClient, workspaceId: string, name: string, excludeId?: string) {
    return db.account.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: "insensitive" },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  },

  async nextSortOrder(db: DbClient, workspaceId: string) {
    const last = await db.account.aggregate({ where: { workspaceId }, _max: { sortOrder: true } });
    return (last._max.sortOrder ?? -1) + 1;
  },

  /** Tudo que referencia a conta e impede excluí-la. */
  async references(db: DbClient, id: string) {
    const [transactions, transfers, recurrences, installmentPlans, cards, goals, imports] =
      await Promise.all([
        db.transaction.count({ where: { accountId: id } }),
        db.transaction.count({ where: { transferAccountId: id } }),
        db.recurrence.count({ where: { accountId: id } }),
        db.installmentPlan.count({ where: { accountId: id } }),
        db.creditCard.count({ where: { paymentAccountId: id } }),
        db.goal.count({ where: { linkedAccountId: id } }),
        db.importBatch.count({ where: { accountId: id } }),
      ]);
    return transactions + transfers + recurrences + installmentPlans + cards + goals + imports;
  },

  /** Lançamentos (não excluídos) por conta, como origem ou destino. */
  async transactionCounts(db: DbClient, workspaceId: string) {
    const rows = await db.$queryRaw<{ account_id: string; count: bigint }[]>(Prisma.sql`
      SELECT account_id, COUNT(*)::bigint AS count FROM (
        SELECT account_id FROM fin_transactions WHERE workspace_id = ${workspaceId}::uuid AND account_id IS NOT NULL AND deleted_at IS NULL
        UNION ALL
        SELECT transfer_account_id FROM fin_transactions WHERE workspace_id = ${workspaceId}::uuid AND transfer_account_id IS NOT NULL AND deleted_at IS NULL
      ) t GROUP BY account_id`);
    return new Map(rows.map((r) => [r.account_id, Number(r.count)]));
  },

  /**
   * Lançamentos liquidados ANTES da data do saldo inicial: não entram no saldo (o saldo inicial
   * já os incluiria), mas entram nos totais do mês. Mostrados para a divergência nunca ficar muda.
   */
  async beforeStart(db: DbClient, workspaceId: string) {
    const rows = await db.$queryRaw<{ id: string; count: number; earliest: Date }[]>(Prisma.sql`
      SELECT a.id, COUNT(t.id)::int AS count, MIN(t.settled_at) AS earliest
      FROM fin_accounts a
      JOIN fin_transactions t
        ON (t.account_id = a.id OR t.transfer_account_id = a.id)
       AND t.status = 'SETTLED' AND t.deleted_at IS NULL
       AND t.settled_at < a.initial_balance_date
      WHERE a.workspace_id = ${workspaceId}::uuid
      GROUP BY a.id`);
    return new Map(rows.map((r) => [r.id, { count: r.count, earliest: r.earliest }]));
  },

  /**
   * Saldo de cada conta = saldo inicial + efeitos dos lançamentos liquidados
   * (docs/03-banco-de-dados.md §4). Com `asOf`, considera só o que foi liquidado até essa data.
   */
  async balances(db: DbClient, workspaceId: string, asOf?: ISODate): Promise<Map<string, Decimal>> {
    const limit = asOf ? Prisma.sql`AND t.settled_at <= ${toDbDate(asOf)}` : Prisma.empty;
    const rows = await db.$queryRaw<{ id: string; balance: string }[]>(Prisma.sql`
      SELECT a.id,
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
            ${limit}
      WHERE a.workspace_id = ${workspaceId}::uuid
      GROUP BY a.id`);
    return new Map(rows.map((r) => [r.id, toMoney(r.balance)]));
  },
};
