import prisma from "@/lib/prisma";
import { getItem, getAccounts, getTransactions, type PluggyAccount } from "@/lib/pluggy";

function mapTipoConta(account: PluggyAccount): "CORRENTE" | "POUPANCA" | "CARTAO" {
  // account.type só é "BANK" ou "CREDIT" — quem indica cartão é o subtype.
  if (account.subtype === "CREDIT_CARD") return "CARTAO";
  if (account.subtype === "SAVINGS_ACCOUNT") return "POUPANCA";
  return "CORRENTE";
}

// Importa (ou re-sincroniza, se já existir) todas as contas de um item recém-conectado
// no widget Pluggy Connect. Idempotente: chamar de novo pro mesmo item só traz o que
// mudou (createMany com skipDuplicates usa o pluggyTransactionId único).
export async function importarItemOpenFinance(itemId: string, criadoPorId: string) {
  const [item, accounts] = await Promise.all([getItem(itemId), getAccounts(itemId)]);

  const contas = [];
  for (const account of accounts) {
    const transacoes = await getTransactions(account.id);

    // saldoInicial é calibrado pra que saldoInicial + soma(lançamentos importados) bata
    // exatamente com o saldo atual da conta reportado pela Pluggy no momento da conexão.
    const somaTransacoes = transacoes.reduce(
      (acc, t) => acc + (t.type === "CREDIT" ? Math.abs(t.amount) : -Math.abs(t.amount)),
      0
    );

    const conta = await prisma.financeiroConta.upsert({
      where: { pluggyAccountId: account.id },
      update: { ultimaSincronizacao: new Date() },
      create: {
        nome: account.name,
        tipo: mapTipoConta(account),
        origem: "OPEN_FINANCE",
        instituicao: item.connector.name,
        saldoInicial: account.balance - somaTransacoes,
        pluggyItemId: itemId,
        pluggyAccountId: account.id,
        ultimaSincronizacao: new Date(),
      },
    });

    if (transacoes.length > 0) {
      await prisma.financeiroLancamento.createMany({
        data: transacoes.map((t) => ({
          contaId: conta.id,
          tipo: (t.type === "CREDIT" ? "ENTRADA" : "SAIDA") as "ENTRADA" | "SAIDA",
          descricao: t.description || "Transação Open Finance",
          valor: Math.abs(t.amount),
          data: new Date(t.date),
          origem: "OPEN_FINANCE" as const,
          pluggyTransactionId: t.id,
          criadoPorId,
        })),
        skipDuplicates: true,
      });
    }

    contas.push(conta);
  }

  return contas;
}

// Puxa só as transações novas desde a última sincronização (com alguns dias de folga,
// porque o extrato do banco pode compensar lançamentos com atraso de D+1/D+2).
// criadoPorId fica de fora quando quem disparou a sincronização não foi uma pessoa
// (ex: webhook da Pluggy) — o campo é opcional em FinanceiroLancamento pra esse caso.
export async function sincronizarContaOpenFinance(contaId: string, criadoPorId?: string) {
  const conta = await prisma.financeiroConta.findUnique({ where: { id: contaId } });
  if (!conta || conta.origem !== "OPEN_FINANCE" || !conta.pluggyAccountId) {
    throw new Error("Conta não é uma conta Open Finance conectada");
  }

  const from = conta.ultimaSincronizacao
    ? new Date(conta.ultimaSincronizacao.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : undefined;

  const transacoes = await getTransactions(conta.pluggyAccountId, from);

  let novos = 0;
  if (transacoes.length > 0) {
    const resultado = await prisma.financeiroLancamento.createMany({
      data: transacoes.map((t) => ({
        contaId: conta.id,
        tipo: (t.type === "CREDIT" ? "ENTRADA" : "SAIDA") as "ENTRADA" | "SAIDA",
        descricao: t.description || "Transação Open Finance",
        valor: Math.abs(t.amount),
        data: new Date(t.date),
        origem: "OPEN_FINANCE" as const,
        pluggyTransactionId: t.id,
        criadoPorId,
      })),
      skipDuplicates: true,
    });
    novos = resultado.count;
  }

  await prisma.financeiroConta.update({
    where: { id: conta.id },
    data: { ultimaSincronizacao: new Date() },
  });

  return { novos };
}

// Usado pelo webhook: um item pode ter mais de uma conta (ex: corrente + poupança do
// mesmo banco), então sincroniza todas as que já foram importadas pra esse item.
export async function sincronizarItemOpenFinance(pluggyItemId: string) {
  const contas = await prisma.financeiroConta.findMany({
    where: { origem: "OPEN_FINANCE", pluggyItemId },
    select: { id: true },
  });

  for (const conta of contas) {
    await sincronizarContaOpenFinance(conta.id);
  }

  return { contasSincronizadas: contas.length };
}
