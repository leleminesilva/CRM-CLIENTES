import type { Metadata } from "next";
import { requirePageContext } from "@fin/lib/context";
import { prisma } from "@fin/lib/db";
import { resolveMonth, type SearchParams } from "@fin/lib/month";
import { CommissionsView } from "@fin/modules/commissions/components/commissions-view";
import { commissionStats, listCommissions } from "@fin/modules/commissions/queries";
import { readCommissionSettings } from "@fin/crm/comissoes";
import { loadFormOptions } from "@fin/modules/transactions/queries";

export const metadata: Metadata = { title: "Comissões" };

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await requirePageContext();
  const { month, currentMonth } = resolveMonth((await searchParams).mes, ctx.today);
  const [commissions, stats, options, users, workspace] = await Promise.all([
    listCommissions(ctx, ctx.today, { month }),
    commissionStats(ctx, month, ctx.today),
    loadFormOptions(ctx),
    prisma.user.findMany({ where: { ativo: true }, select: { nome: true }, orderBy: { nome: "asc" } }),
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { settings: true } }),
  ]);
  return (
    <CommissionsView
      commissions={commissions}
      stats={stats}
      month={month}
      currentMonth={currentMonth}
      accounts={options.accounts}
      sellers={users.map((u) => u.nome)}
      settings={readCommissionSettings(workspace?.settings)}
      today={ctx.today}
    />
  );
}
