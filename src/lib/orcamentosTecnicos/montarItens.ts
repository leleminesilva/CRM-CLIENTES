import prisma from "@/lib/prisma";
import type { ItemOrcamentoTecnicoInput } from "@/lib/validators/orcamentoTecnico";
import { calcularItem, dimensaoValidaParaModo } from "./calc";

// Busca produto+variante de cada item, valida a dimensão exigida pelo
// modoCalculo, e calcula precoCalculado/totalItem no servidor — nunca confia
// em preço vindo do cliente. Usado pelas rotas de criar e atualizar orçamento.
export async function montarItensCalculados(itens: ItemOrcamentoTecnicoInput[]) {
  const resultado = [];
  for (const item of itens) {
    const produto = await prisma.produtoCatalogo.findFirst({
      where: { id: item.produtoId, deletedAt: null },
    });
    if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado`);

    if (!dimensaoValidaParaModo(produto.modoCalculo, item.larguraMm, item.alturaMm, item.comprimentoMm)) {
      throw new Error(`Dimensão obrigatória faltando para o produto "${produto.nome}"`);
    }

    let precoVariante: number | null = null;
    if (item.varianteId) {
      const variante = await prisma.varianteProduto.findFirst({
        where: { id: item.varianteId, produtoId: produto.id, deletedAt: null },
      });
      if (!variante) throw new Error(`Variante ${item.varianteId} não encontrada`);
      precoVariante = Number(variante.precoUnitario);
    }

    const { precoCalculado, totalItem } = calcularItem({
      modoCalculo: produto.modoCalculo,
      precoBase: Number(produto.precoBase),
      precoVariante,
      larguraMm: item.larguraMm,
      alturaMm: item.alturaMm,
      comprimentoMm: item.comprimentoMm,
      quantidade: item.quantidade,
      acrescimoValor: item.acrescimoValor,
    });

    resultado.push({
      produtoId: item.produtoId,
      varianteId: item.varianteId || null,
      larguraMm: item.larguraMm ?? null,
      alturaMm: item.alturaMm ?? null,
      comprimentoMm: item.comprimentoMm ?? null,
      quantidade: item.quantidade,
      ambienteInstalacao: item.ambienteInstalacao || null,
      descricao: item.descricao || null,
      acrescimoValor: item.acrescimoValor,
      precoCalculado,
      totalItem,
      ordem: item.ordem,
    });
  }
  return resultado;
}
