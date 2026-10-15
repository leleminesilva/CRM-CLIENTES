import { ensureSystemCategory } from "@fin/crm/categorias";
import { audit } from "@fin/lib/audit";
import { toDbDate, type ISODate } from "@fin/lib/dates";
import { prisma, type DbClient } from "@fin/lib/db";
import { AppError } from "@fin/lib/errors";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";
import type { EmployeeInput } from "./schemas";

export const PAYROLL_CATEGORY_KEY = "payroll_salary";

/** Categoria de despesa "Salários" (de sistema): adota a existente ou cria na primeira folha. */
function payrollCategory(db: DbClient, workspaceId: string) {
  return ensureSystemCategory(db, workspaceId, {
    systemKey: PAYROLL_CATEGORY_KEY,
    create: {
      kind: "EXPENSE",
      name: "Salários",
      icon: "wallet",
      color: "#0ea5e9",
      defaultNature: "FIXED",
      isEssential: true,
    },
  });
}

export async function createEmployee(ctx: ServiceContext, input: EmployeeInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const e = await tx.employee.create({
      data: {
        workspaceId: ctx.workspaceId,
        name: input.name,
        position: input.position,
        salary: input.salary,
        payDay: input.payDay,
        crmUserId: input.crmUserId,
        notes: input.notes,
      },
    });
    await audit(tx, ctx, { action: "employee.create", entityType: "Employee", entityId: e.id, after: e });
    return e;
  });
}

export async function updateEmployee(ctx: ServiceContext, id: string, input: EmployeeInput) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const before = await tx.employee.findFirst({ where: { id, workspaceId: ctx.workspaceId, deletedAt: null } });
    if (!before) throw new AppError("NOT_FOUND");
    const after = await tx.employee.update({
      where: { id },
      data: {
        name: input.name,
        position: input.position,
        salary: input.salary,
        payDay: input.payDay,
        crmUserId: input.crmUserId,
        notes: input.notes,
      },
    });
    await audit(tx, ctx, { action: "employee.update", entityType: "Employee", entityId: id, before, after });
    return after;
  });
}

/** Funcionário desligado: some das próximas folhas; os pagamentos já feitos ficam no histórico. */
export async function archiveEmployee(ctx: ServiceContext, id: string) {
  assertCan(ctx, "write");
  await prisma.$transaction(async (tx) => {
    const e = await tx.employee.findFirst({ where: { id, workspaceId: ctx.workspaceId, deletedAt: null } });
    if (!e) throw new AppError("NOT_FOUND");
    await tx.employee.update({ where: { id }, data: { active: false, deletedAt: new Date() } });
    await audit(tx, ctx, { action: "employee.archive", entityType: "Employee", entityId: id, before: e });
  });
}

/**
 * Gera o pagamento do mês de cada funcionário ativo (uma despesa a pagar no dia do pagamento).
 * Idempotente: quem já tem pagamento no mês é pulado.
 */
export async function generatePayroll(ctx: ServiceContext, month: string) {
  assertCan(ctx, "write");
  return prisma.$transaction(async (tx) => {
    const category = await payrollCategory(tx, ctx.workspaceId);
    const employees = await tx.employee.findMany({
      where: { workspaceId: ctx.workspaceId, active: true, deletedAt: null },
      orderBy: { name: "asc" },
    });
    const existing = await tx.payroll.findMany({
      where: { workspaceId: ctx.workspaceId, month },
      select: { employeeId: true },
    });
    const done = new Set(existing.map((p) => p.employeeId));
    let created = 0;
    for (const e of employees) {
      if (done.has(e.id)) continue;
      const due = `${month}-${String(e.payDay).padStart(2, "0")}` as ISODate;
      const transaction = await tx.transaction.create({
        data: {
          workspaceId: ctx.workspaceId,
          type: "EXPENSE",
          nature: "FIXED",
          categoryId: category.id,
          paymentMethod: null,
          description: `Salário: ${e.name}`,
          amount: e.salary,
          date: toDbDate(due),
          dueDate: toDbDate(due),
          status: "PENDING",
          settledAt: null,
          accountId: null,
        },
      });
      const p = await tx.payroll.create({
        data: { workspaceId: ctx.workspaceId, employeeId: e.id, month, transactionId: transaction.id },
      });
      await audit(tx, ctx, {
        action: "payroll.create",
        entityType: "Payroll",
        entityId: p.id,
        after: { ...p, amount: e.salary.toString() },
      });
      created += 1;
    }
    return { created, skipped: employees.length - created, total: employees.length };
  });
}
