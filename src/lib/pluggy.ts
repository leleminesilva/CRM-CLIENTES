// Client server-side pra API da Pluggy (agregador de Open Finance — ver dashboard.pluggy.ai),
// em cima do SDK oficial `pluggy-sdk`. Autenticação: PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET (env,
// nunca NEXT_PUBLIC_) — o SDK troca isso por um apiKey de curta duração e cacheia sozinho.

import { PluggyClient } from "pluggy-sdk";

let client: PluggyClient | null = null;

function getClient(): PluggyClient {
  if (client) return client;

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET não configurados no ambiente");
  }

  client = new PluggyClient({ clientId, clientSecret });
  return client;
}

// Token de uso único/curto pro widget Pluggy Connect abrir no navegador do usuário.
// itemId presente = reconectar/atualizar um item existente (ex: credencial expirada).
export async function createConnectToken(itemId?: string): Promise<string> {
  const { accessToken } = await getClient().createConnectToken(itemId);
  return accessToken;
}

export interface PluggyItem {
  id: string;
  status: string;
  executionStatus: string;
  connector: { id: number; name: string; imageUrl?: string };
}

export async function getItem(itemId: string): Promise<PluggyItem> {
  return getClient().fetchItem(itemId);
}

export async function deleteItem(itemId: string): Promise<void> {
  await getClient().deleteItem(itemId);
}

export interface PluggyAccount {
  id: string;
  itemId: string;
  type: "BANK" | "CREDIT" | string;
  subtype: string;
  name: string;
  balance: number;
  currencyCode: string;
}

export async function getAccounts(itemId: string): Promise<PluggyAccount[]> {
  const { results } = await getClient().fetchAccounts(itemId);
  return results;
}

// type vem separado do amount porque o sinal de amount é invertido em contas de cartão de
// crédito (positivo = despesa que aumenta a fatura, negativo = pagamento da fatura) — usar
// só o type evita ler entrada/saída trocado nesse tipo de conta.
export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  date: string;
}

export async function getTransactions(accountId: string, from?: string): Promise<PluggyTransaction[]> {
  const transacoes = await getClient().fetchAllTransactions(accountId, from ? { dateFrom: from } : undefined);
  return transacoes.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    description: t.description,
    amount: t.amount,
    type: t.type,
    date: new Date(t.date).toISOString(),
  }));
}
