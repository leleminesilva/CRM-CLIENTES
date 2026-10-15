import { fromDbDate, type ISODate, type MonthKey, monthRange, toDbDate } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { sumMoney, toMoneyString } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { displayStatus, type DisplayStatus } from "@fin/modules/transactions/domain/status";

export interface PayrollRowDTO {
  employeeId: string;
  name: string;
  position: string | null;
  salary: string;
  payDay: number;
  crmUserId: string | null;
  notes: string | null;
  /** Pagamento do mês (null = folha ainda não gerada para este funcionário). */
  entry: {
    transactionId: string;
    amount: string;
    status: DisplayStatus;
    dueDate: ISODate;
    settledAt: ISODate | null;
    account: { id: string; name: string } | null;
  } | null;
  /** Comissões a pagar a esta pessoa com previsão neste mês (canceladas ficam de fora). */
  commission: string;
}

export interface PayrollOverview {
  rows: PayrollRowDTO[];
  total: string;
  paid: string;
  pending: string;
  missing: number;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export async function payrollOverview(
  ctx: ServiceContext,
  month: MonthKey,
  today: ISODate,
): Promise<PayrollOverview> {
  const range = monthRange(month);
  const [employees, payrolls, commissions, users] = await Promise.all([
    prisma.employee.findMany({
      where: { workspaceId: ctx.workspaceId, active: true, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.payroll.findMany({
      where: { workspaceId: ctx.workspaceId, month },
      include: { transaction: { include: { account: { select: { id: true, name: true } } } } },
    }),
    prisma.commission.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        deletedAt: null,
        transaction: {
          deletedAt: null,
          status: { not: "CANCELED" },
          dueDate: { gte: toDbDate(range.start), lte: toDbDate(range.end) },
        },
      },
      select: { sellerName: true, transaction: { select: { amount: true } } },
    }),
    prisma.user.findMany({ select: { id: true, nome: true } }),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.nome]));
  const byEmployee = new Map(payrolls.map((p) => [p.employeeId, p]));

  const rows: PayrollRowDTO[] = employees.map((e) => {
    const p = byEmployee.get(e.id);
    const names = new Set([norm(e.name)]);
    if (e.crmUserId && userName.get(e.crmUserId)) names.add(norm(userName.get(e.crmUserId)!));
    const mine = commissions.filter((c) => names.has(norm(c.sellerName)));
    return {
      employeeId: e.id,
      name: e.name,
      position: e.position,
      salary: toMoneyString(e.salary),
      payDay: e.payDay,
      crmUserId: e.crmUserId,
      notes: e.notes,
      entry: p
        ? {
            transactionId: p.transaction.id,
            amount: toMoneyString(p.transaction.amount),
            status: displayStatus(p.transaction.status, fromDbDate(p.transaction.dueDate), today),
            dueDate: fromDbDate(p.transaction.dueDate),
            settledAt: p.transaction.settledAt ? fromDbDate(p.transaction.settledAt) : null,
            account: p.transaction.account,
          }
        : null,
      commission: toMoneyString(sumMoney(mine.map((c) => c.transaction.amount))),
    };
  });

  const valid = payrolls.filter((p) => p.transaction.status !== "CANCELED" && !p.transaction.deletedAt);
  const sum = (list: typeof valid) => toMoneyString(sumMoney(list.map((p) => p.transaction.amount)));
  return {
    rows,
    total: sum(valid),
    paid: sum(valid.filter((p) => p.transaction.status === "SETTLED")),
    pending: sum(valid.filter((p) => p.transaction.status === "PENDING")),
    missing: rows.filter((r) => !r.entry).length,
  };
}

export async function crmUserOptions(): Promise<{ id: string; nome: string }[]> {
  return prisma.user.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
}
