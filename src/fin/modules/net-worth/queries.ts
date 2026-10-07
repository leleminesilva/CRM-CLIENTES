import { Prisma } from "@prisma/client";
import {
  addMonthsToKey,
  fromDbDate,
  type ISODate,
  lastDayOfMonth,
  type MonthKey,
  monthKeyOf,
  toDbDate,
} from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { type Money, sumMoney, toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { accountRepository } from "@fin/modules/accounts/repository";

export interface NetWorthLine {
  key: string;
  label: string;
  value: string;
  href?: string;
}

export interface NetWorthSnapshotData {
  date: ISODate;
  liquid: string;
  invested: string;
  assetsTotal: string;
  liabilitiesTotal: string;
  netWorth: string;
  assets: NetWorthLine[];
  liabilities: NetWorthLine[];
}

/** Dívida em cartão (compras e parcelas não pagas) e em parcelamentos fora do cartão, numa data. */
async function installmentAndCardDebt(workspaceId: string, asOf: ISODate) {
  const d = toDbDate(asOf);
  const [row] = await prisma.$queryRaw<{ card: string | null; plans: string | null }[]>(Prisma.sql`
    SELECT
      SUM(CASE WHEN t.credit_card_id IS NOT NULL THEN (CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE -t.amount END) END)::text AS card,
      SUM(CASE WHEN t.credit_card_id IS NULL THEN t.amount END)::text AS plans
    FROM fin_transactions t
    LEFT JOIN fin_installment_plans p ON p.id = t.installment_plan_id
    WHERE t.workspace_id = ${workspaceId}::uuid AND t.deleted_at IS NULL AND t.status <> 'CANCELED'
      AND t.type IN ('EXPENSE', 'REFUND')
      AND (t.status = 'PENDING' OR t.settled_at > ${d})
      AND (
        (t.installment_plan_id IS NOT NULL AND p.purchase_date <= ${d})
        OR (t.installment_plan_id IS NULL AND t.credit_card_id IS NOT NULL AND t.date <= ${d})
      )`);
  const [partial] = await prisma.$queryRaw<{ paid: string | null }[]>(Prisma.sql`
    SELECT SUM(t.amount)::text AS paid
    FROM fin_transactions t JOIN fin_credit_card_invoices i ON i.id = t.invoice_id
    WHERE t.workspace_id = ${workspaceId}::uuid AND t.deleted_at IS NULL AND t.type = 'CARD_PAYMENT' AND t.status = 'SETTLED'
      AND t.settled_at <= ${d} AND i.status <> 'PAID'`);
  return {
    card: toMoney(row?.card ?? 0).minus(toMoney(partial?.paid ?? 0)),
    plans: toMoney(row?.plans ?? 0),
  };
}

/** Patrimônio líquido numa data: ativos (contas + bens avaliados) − passivos (cartões, parcelas, dívidas). */
export async function netWorthAsOf(
  ctx: ServiceContext,
  asOf: ISODate,
): Promise<NetWorthSnapshotData> {
  const [accounts, balances, assets, liabilities, debt] = await Promise.all([
    prisma.account.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null, includeInNetWorth: true },
      orderBy: [{ sortOrder: "asc" }],
    }),
    accountRepository.balances(prisma, ctx.workspaceId, asOf),
    prisma.asset.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null },
      include: {
        valuations: {
          where: { date: { lte: toDbDate(asOf) } },
          orderBy: { date: "desc" },
          take: 1,
        },
      },
    }),
    prisma.liability.findMany({
      where: { workspaceId: ctx.workspaceId, archivedAt: null, startDate: { lte: toDbDate(asOf) } },
    }),
    installmentAndCardDebt(ctx.workspaceId, asOf),
  ]);

  const accountLines = accounts.map((a) => ({
    key: `account:${a.id}`,
    label: a.name,
    value: balances.get(a.id) ?? ZERO,
    liquid: a.isLiquid,
    investment: a.type === "INVESTMENT",
  }));
  const assetLines = assets
    .filter((a) => a.valuations[0] !== undefined)
    .map((a) => ({ key: `asset:${a.id}`, label: a.name, value: toMoney(a.valuations[0]!.value) }));
  const assetList: { key: string; label: string; value: Money }[] = [
    ...accountLines,
    ...assetLines,
  ];

  const liabilityList: { key: string; label: string; value: Money; href?: string }[] = [];
  if (debt.card.greaterThan(0))
    liabilityList.push({
      key: "cards",
      label: "Cartões de crédito (inclui parcelas futuras)",
      value: debt.card,
      href: "/financeiro/cartoes",
    });
  if (debt.plans.greaterThan(0))
    liabilityList.push({
      key: "plans",
      label: "Parcelamentos em boleto e carnê",
      value: debt.plans,
      href: "/financeiro/parcelamentos",
    });
  for (const l of liabilities)
    liabilityList.push({
      key: `liability:${l.id}`,
      label: l.name,
      value: toMoney(l.currentBalance ?? l.originalAmount),
    });

  const assetsTotal = sumMoney(assetList.map((a) => a.value));
  const liabilitiesTotal = sumMoney(liabilityList.map((l) => l.value));
  return {
    date: asOf,
    liquid: toMoneyString(sumMoney(accountLines.filter((a) => a.liquid).map((a) => a.value))),
    invested: toMoneyString(sumMoney(accountLines.filter((a) => a.investment).map((a) => a.value))),
    assetsTotal: toMoneyString(assetsTotal),
    liabilitiesTotal: toMoneyString(liabilitiesTotal),
    netWorth: toMoneyString(assetsTotal.minus(liabilitiesTotal)),
    assets: assetList.map((a) => ({ key: a.key, label: a.label, value: toMoneyString(a.value) })),
    liabilities: liabilityList.map((l) => ({
      key: l.key,
      label: l.label,
      value: toMoneyString(l.value),
      href: l.href,
    })),
  };
}

/** Evolução: o fim de cada um dos últimos N meses (o mês atual usa hoje). */
export async function netWorthHistory(ctx: ServiceContext, today: ISODate, months = 12) {
  const current = monthKeyOf(today);
  const keys: MonthKey[] = Array.from({ length: months }, (_, i) =>
    addMonthsToKey(current, i - (months - 1)),
  );
  const points = await Promise.all(
    keys.map(async (month) => {
      const date = month === current ? today : lastDayOfMonth(month);
      const s = await netWorthAsOf(ctx, date);
      return {
        month,
        assets: s.assetsTotal,
        liabilities: s.liabilitiesTotal,
        netWorth: s.netWorth,
      };
    }),
  );
  return points;
}

export async function listAssets(ctx: ServiceContext) {
  const assets = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId, archivedAt: null },
    include: { valuations: { orderBy: { date: "desc" }, take: 6 } },
    orderBy: { createdAt: "asc" },
  });
  return assets.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    notes: a.notes,
    acquisitionDate: a.acquisitionDate ? fromDbDate(a.acquisitionDate) : null,
    acquisitionValue: a.acquisitionValue ? toMoneyString(a.acquisitionValue) : null,
    currentValue: toMoneyString(a.currentValue),
    valuedAt: fromDbDate(a.valuedAt),
    valuations: a.valuations.map((v) => ({
      date: fromDbDate(v.date),
      value: toMoneyString(v.value),
    })),
  }));
}

export async function listLiabilities(ctx: ServiceContext) {
  const items = await prisma.liability.findMany({
    where: { workspaceId: ctx.workspaceId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return items.map((l) => ({
    id: l.id,
    name: l.name,
    kind: l.kind,
    creditor: l.creditor,
    originalAmount: toMoneyString(l.originalAmount),
    currentBalance: toMoneyString(l.currentBalance ?? l.originalAmount),
    startDate: fromDbDate(l.startDate),
    endDate: l.endDate ? fromDbDate(l.endDate) : null,
    notes: l.notes,
  }));
}
