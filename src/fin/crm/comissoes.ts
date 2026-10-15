import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { audit } from "@fin/lib/audit";
import { type ISODate, toDbDate } from "@fin/lib/dates";
import { type ServiceContext } from "@fin/lib/permissions";
import { COMMISSION_PAYOUT_KEY } from "@fin/modules/commissions/service";
import { computeCommission } from "@fin/modules/commissions/domain/commission";
import { ensureBusinessWorkspace } from "@fin/lib/workspace";

// Comissão automática: cada venda registrada no CRM gera a comissão do vendedor (despesa a pagar).
// Roda dentro das rotas de venda do CRM, com qualquer cargo: por isso não passa pela sessão do
// Financeiro (que exige acesso liberado) e age como dono do workspace da empresa.

export interface CommissionSettings {
  /** Percentual sobre o valor da venda (ex.: "2" ou "2.5"). */
  ratePercent: string;
  /** Dia do mês seguinte em que a comissão é paga (junto com o salário). */
  payDay: number;
}

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = { ratePercent: "2", payDay: 5 };

export function readCommissionSettings(settings: unknown): CommissionSettings {
  const raw = (settings as { commission?: Partial<CommissionSettings> } | null)?.commission ?? {};
  const rate = Number.parseFloat(String(raw.ratePercent ?? ""));
  const day = Number(raw.payDay);
  return {
    ratePercent: rate > 0 && rate <= 100 ? String(raw.ratePercent) : DEFAULT_COMMISSION_SETTINGS.ratePercent,
    payDay: Number.isInteger(day) && day >= 1 && day <= 28 ? day : DEFAULT_COMMISSION_SETTINGS.payDay,
  };
}

/** Dia `payDay` do mês seguinte à venda (ex.: venda de 15/10 com dia 5 → 05/11). */
export function commissionPayDate(saleDay: ISODate, payDay: number): ISODate {
  const [y, m] = saleDay.split("-").map(Number) as [number, number];
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  return `${next.y}-${String(next.m).padStart(2, "0")}-${String(payDay).padStart(2, "0")}`;
}

const dayOf = (d: Date) => d.toISOString().slice(0, 10) as ISODate;

export async function businessContext(userId: string): Promise<ServiceContext & { settings: CommissionSettings }> {
  const ws = await ensureBusinessWorkspace();
  return { userId, workspaceId: ws.id, role: "OWNER", settings: readCommissionSettings(ws.settings) };
}

async function payoutCategory(tx: Prisma.TransactionClient, workspaceId: string) {
  const found = await tx.category.findFirst({ where: { workspaceId, systemKey: COMMISSION_PAYOUT_KEY } });
  if (found) return found;
  return tx.category.create({
    data: {
      workspaceId,
      kind: "EXPENSE",
      name: "Comissões de vendedores",
      icon: "badge-percent",
      color: "#8b5cf6",
      defaultNature: "VARIABLE",
      systemKey: COMMISSION_PAYOUT_KEY,
    },
  });
}

type VendaRow = {
  id: string;
  numeroOrcamento: string;
  valor: Prisma.Decimal | number | string;
  data: Date;
  cliente: { nome: string };
  responsavel: { nome: string } | null;
};

/**
 * Cria (ou atualiza) a comissão de uma venda. Idempotente: a mesma venda nunca gera duas.
 * Comissão já lançada com o mesmo nº de orçamento (ex.: importada por CSV) é adotada, não duplicada.
 * Retorna "created" | "updated" | "adopted" | "skipped".
 */
async function upsertFromVenda(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext & { settings: CommissionSettings },
  venda: VendaRow,
): Promise<"created" | "updated" | "adopted" | "skipped"> {
  const sale = Number(venda.valor).toFixed(2);
  if (Number(sale) <= 0) return "skipped";
  const saleDay = dayOf(venda.data);
  const expected = commissionPayDate(saleDay, ctx.settings.payDay);
  const amount = computeCommission(sale, ctx.settings.ratePercent).toFixed(2);
  const seller = venda.responsavel?.nome ?? "Sem vendedor";
  const description = `Orçamento ${venda.numeroOrcamento}`;

  const linked = await tx.commission.findFirst({
    where: { workspaceId: ctx.workspaceId, vendaId: venda.id, deletedAt: null },
    include: { transaction: true },
  });
  if (linked) {
    // Comissão já paga não muda de valor sozinha; pendente acompanha edições da venda.
    if (linked.transaction.status === "SETTLED") return "skipped";
    await tx.transaction.update({
      where: { id: linked.transactionId },
      data: {
        description: `Comissão: ${seller} · ${venda.cliente.nome}`,
        amount,
        date: toDbDate(saleDay),
        dueDate: toDbDate(expected),
      },
    });
    await tx.commission.update({
      where: { id: linked.id },
      data: {
        sellerName: seller,
        clientName: venda.cliente.nome,
        saleDescription: description,
        saleAmount: sale,
        ratePercent: ctx.settings.ratePercent,
        isAmountOverridden: false,
        saleDate: toDbDate(saleDay),
      },
    });
    return "updated";
  }

  const sameBudget = await tx.commission.findFirst({
    where: { workspaceId: ctx.workspaceId, vendaId: null, saleDescription: description, deletedAt: null },
  });
  if (sameBudget) {
    await tx.commission.update({ where: { id: sameBudget.id }, data: { vendaId: venda.id } });
    return "adopted";
  }

  const category = await payoutCategory(tx, ctx.workspaceId);
  const transaction = await tx.transaction.create({
    data: {
      workspaceId: ctx.workspaceId,
      type: "EXPENSE",
      nature: "VARIABLE",
      categoryId: category.id,
      paymentMethod: null,
      description: `Comissão: ${seller} · ${venda.cliente.nome}`,
      amount,
      date: toDbDate(saleDay),
      dueDate: toDbDate(expected),
      status: "PENDING",
      settledAt: null,
      accountId: null,
    },
  });
  const commission = await tx.commission.create({
    data: {
      workspaceId: ctx.workspaceId,
      transactionId: transaction.id,
      vendaId: venda.id,
      sellerName: seller,
      clientName: venda.cliente.nome,
      saleDescription: description,
      saleAmount: sale,
      ratePercent: ctx.settings.ratePercent,
      isAmountOverridden: false,
      saleDate: toDbDate(saleDay),
      notes: null,
    },
  });
  await audit(tx, ctx, {
    action: "commission.create",
    entityType: "Commission",
    entityId: commission.id,
    after: { ...commission, amount, auto: true },
  });
  return "created";
}

const vendaInclude = {
  cliente: { select: { nome: true } },
  responsavel: { select: { nome: true } },
} as const;

/** Chamada quando uma venda é registrada ou editada. Nunca lança: a venda não pode falhar por isso. */
export async function syncCommissionForVenda(vendaId: string, actingUserId: string): Promise<void> {
  try {
    const venda = await prisma.venda.findFirst({ where: { id: vendaId, deletedAt: null }, include: vendaInclude });
    if (!venda) return;
    const ctx = await businessContext(actingUserId);
    await prisma.$transaction((tx) => upsertFromVenda(tx, ctx, venda));
  } catch (error) {
    console.error("[comissão automática] falhou para a venda", vendaId, error);
  }
}

/** Venda removida: a comissão ainda pendente some junto; a já paga fica no histórico. */
export async function removeCommissionForVenda(vendaId: string, actingUserId: string): Promise<void> {
  try {
    const ctx = await businessContext(actingUserId);
    await prisma.$transaction(async (tx) => {
      const c = await tx.commission.findFirst({
        where: { workspaceId: ctx.workspaceId, vendaId, deletedAt: null },
        include: { transaction: true },
      });
      if (!c) return;
      if (c.transaction.status === "SETTLED") {
        await tx.commission.update({ where: { id: c.id }, data: { vendaId: null } });
        return;
      }
      await tx.commission.delete({ where: { id: c.id } });
      await tx.attachment.deleteMany({ where: { transactionId: c.transactionId } });
      await tx.transaction.delete({ where: { id: c.transactionId } });
      await audit(tx, ctx, { action: "commission.delete", entityType: "Commission", entityId: c.id, before: c });
    });
  } catch (error) {
    console.error("[comissão automática] falhou ao remover da venda", vendaId, error);
  }
}

/** Gera as comissões que faltam das vendas de um mês (botão "Gerar das vendas do mês"). */
export async function syncCommissionsForMonth(actingUserId: string, month: string) {
  const ctx = await businessContext(actingUserId);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  const vendas = await prisma.venda.findMany({
    where: { deletedAt: null, data: { gte: from, lt: to } },
    include: vendaInclude,
    orderBy: { data: "asc" },
  });
  const result = { created: 0, updated: 0, adopted: 0, skipped: 0, total: vendas.length };
  await prisma.$transaction(
    async (tx) => {
      for (const v of vendas) result[await upsertFromVenda(tx, ctx, v)] += 1;
    },
    { timeout: 60_000 },
  );
  return result;
}
