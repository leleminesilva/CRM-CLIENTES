import { fromDbDate, type ISODate, type MonthKey, monthRange, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { sumMoney, toMoneyString } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { displayStatus, type DisplayStatus } from "@fin/modules/transactions/domain/status";

export interface ChequeDTO {
  id: string;
  transactionId: string;
  direction: "ISSUED" | "RECEIVED";
  number: string;
  bank: string | null;
  party: string;
  amount: string;
  issueDate: ISODate;
  dueDate: ISODate;
  settledAt: ISODate | null;
  bounced: boolean;
  status: DisplayStatus;
  account: { id: string; name: string } | null;
  notes: string | null;
}

export interface ChequeStats {
  /** Emitidos ainda a compensar com "bom para" no mês. */
  issuedPending: string;
  /** Recebidos ainda a depositar com "bom para" no mês. */
  receivedPending: string;
  /** Compensados no mês (emitidos e recebidos). */
  cleared: string;
  clearedCount: number;
  /** Devolvidos (todos os meses). */
  bounced: string;
  bouncedCount: number;
}

export async function listCheques(
  ctx: ServiceContext,
  today: ISODate,
  month: MonthKey,
): Promise<{ cheques: ChequeDTO[]; stats: ChequeStats }> {
  const range = monthRange(month);
  const base = { workspaceId: ctx.workspaceId, deletedAt: null, transaction: { deletedAt: null } };
  const include = { transaction: { include: { account: { select: { id: true, name: true } } } } };
  const [inMonth, bouncedAll] = await Promise.all([
    prisma.cheque.findMany({
      where: {
        ...base,
        transaction: {
          deletedAt: null,
          dueDate: { gte: toDbDate(range.start), lte: toDbDate(range.end) },
        },
      },
      include,
      orderBy: [{ transaction: { dueDate: "asc" } }, { createdAt: "desc" }],
    }),
    prisma.cheque.findMany({ where: { ...base, bounced: true }, include }),
  ]);

  const cheques: ChequeDTO[] = inMonth.map((c) => {
    const t = c.transaction;
    return {
      id: c.id,
      transactionId: t.id,
      direction: c.direction as "ISSUED" | "RECEIVED",
      number: c.number,
      bank: c.bank,
      party: c.party,
      amount: toMoneyString(t.amount),
      issueDate: fromDbDate(c.issueDate),
      dueDate: fromDbDate(t.dueDate),
      settledAt: t.settledAt ? fromDbDate(t.settledAt) : null,
      bounced: c.bounced,
      status: displayStatus(t.status, fromDbDate(t.dueDate), today),
      account: t.account,
      notes: c.notes,
    };
  });

  const sum = (list: typeof inMonth) => sumMoney(list.map((c) => c.transaction.amount));
  const pending = inMonth.filter((c) => !c.bounced && c.transaction.status === "PENDING");
  const clearedList = inMonth.filter((c) => c.transaction.status === "SETTLED");
  return {
    cheques,
    stats: {
      issuedPending: toMoneyString(sum(pending.filter((c) => c.direction === "ISSUED"))),
      receivedPending: toMoneyString(sum(pending.filter((c) => c.direction === "RECEIVED"))),
      cleared: toMoneyString(sum(clearedList)),
      clearedCount: clearedList.length,
      bounced: toMoneyString(sum(bouncedAll)),
      bouncedCount: bouncedAll.length,
    },
  };
}
