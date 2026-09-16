import type { Prisma } from "@prisma/client";

// Categoria fixa usada pro lançamento automático de gasolina — criada por
// migration, mas com upsert aqui pra não quebrar se alguém excluir/renomear.
export async function criarLancamentoCombustivel(
  tx: Prisma.TransactionClient,
  { contaId, valor, descricao, criadoPorId }: { contaId: string; valor: number; descricao: string; criadoPorId: string }
) {
  const categoria = await tx.financeiroCategoria.upsert({
    where: { nome_tipo: { nome: "Combustível", tipo: "SAIDA" } },
    update: {},
    create: { nome: "Combustível", tipo: "SAIDA", cor: "#0ea5e9", padrao: true },
  });
  return tx.financeiroLancamento.create({
    data: { contaId, categoriaId: categoria.id, tipo: "SAIDA", descricao, valor, data: new Date(), criadoPorId },
  });
}
