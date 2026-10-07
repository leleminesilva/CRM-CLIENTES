import type { Prisma } from "@prisma/client";
import { audit } from "@fin/lib/audit";
import { toDbDate, type ISODate } from "@fin/lib/dates";
import { AppError } from "@fin/lib/errors";
import { round2 } from "@fin/lib/money";
import { assertCan, type ServiceContext } from "@fin/lib/permissions";

// Integração do controle de carros (CRM) com o Financeiro novo: a gasolina entregue ao motorista
// vira uma despesa paga em fin_transactions, ligada ao uso por car_use_id. Substitui
// src/lib/financeiro/combustivel.ts, que lançava no Caixa antigo (financeiro_lancamentos).
// Sem "server-only": também é usado pelo script de cópia do Caixa (scripts/fin-migrar-caixa.ts).

type Tx = Prisma.TransactionClient;

export const FUEL_SYSTEM_KEY = "fuel";
const FUEL_NAME = "Combustível";

/**
 * Categoria "Combustível" do workspace. É de sistema (systemKey), então não pode ser excluída,
 * arquivada nem mesclada — a gasolina dos carros depende dela.
 */
export async function ensureFuelCategory(tx: Tx, workspaceId: string) {
  const system = await tx.category.findFirst({ where: { workspaceId, systemKey: FUEL_SYSTEM_KEY } });
  if (system) return system;
  // Já existe uma "Combustível" de despesa no primeiro nível (ex.: copiada do Caixa antigo): vira a de sistema.
  const twin = await tx.category.findFirst({
    where: {
      workspaceId,
      kind: "EXPENSE",
      parentId: null,
      archivedAt: null,
      name: { equals: FUEL_NAME, mode: "insensitive" },
    },
  });
  if (twin) return tx.category.update({ where: { id: twin.id }, data: { systemKey: FUEL_SYSTEM_KEY } });
  return tx.category.create({
    data: {
      workspaceId,
      kind: "EXPENSE",
      name: FUEL_NAME,
      icon: "fuel",
      color: "#0ea5e9",
      defaultNature: "VARIABLE",
      isEssential: true,
      systemKey: FUEL_SYSTEM_KEY,
    },
  });
}

export interface FuelExpenseInput {
  carUseId: string;
  accountId: string;
  amount: number;
  description: string;
}

/**
 * Cria a despesa de gasolina de um uso de carro ou, se já existe, corrige valor e conta
 * (como fazia o Caixa antigo). Lançada como paga, no dia de hoje do workspace.
 */
export async function upsertFuelExpense(
  tx: Tx,
  ctx: ServiceContext & { today: ISODate },
  input: FuelExpenseInput,
) {
  assertCan(ctx, "write");
  const account = await tx.account.findFirst({ where: { id: input.accountId, workspaceId: ctx.workspaceId } });
  if (!account) throw new AppError("NOT_FOUND");
  if (account.archivedAt) throw new AppError("ACCOUNT_ARCHIVED");
  const amount = round2(input.amount).toFixed(2);

  const current = await tx.transaction.findUnique({ where: { carUseId: input.carUseId } });
  if (current) {
    const after = await tx.transaction.update({
      where: { id: current.id },
      data: { amount, accountId: account.id, deletedAt: null },
    });
    await audit(tx, ctx, {
      action: "transaction.update",
      entityType: "Transaction",
      entityId: current.id,
      before: current,
      after,
    });
    return after;
  }

  const category = await ensureFuelCategory(tx, ctx.workspaceId);
  const day = toDbDate(ctx.today);
  const created = await tx.transaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      type: "EXPENSE",
      status: "SETTLED",
      description: input.description,
      amount,
      date: day,
      dueDate: day,
      settledAt: day,
      accountId: account.id,
      categoryId: category.id,
      nature: category.defaultNature ?? "VARIABLE",
      carUseId: input.carUseId,
    },
  });
  await audit(tx, ctx, {
    action: "transaction.create",
    entityType: "Transaction",
    entityId: created.id,
    after: created,
  });
  return created;
}
