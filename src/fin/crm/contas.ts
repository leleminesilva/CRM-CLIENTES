import prisma from "@/lib/prisma";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Conta do Financeiro novo apta a receber lançamentos (do workspace e não arquivada).
 * Ids que não são UUID (ex.: de uma conta do Caixa antigo numa tela aberta antes da troca)
 * viram null em vez de erro do banco.
 */
export async function findActiveAccount(workspaceId: string, accountId: string | undefined | null) {
  if (!accountId || !UUID.test(accountId)) return null;
  return prisma.account.findFirst({ where: { id: accountId, workspaceId, archivedAt: null } });
}
