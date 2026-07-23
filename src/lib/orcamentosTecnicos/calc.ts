// Motor de cálculo do orçamento técnico — função pura, sem import de Prisma,
// usada tanto pela API (fonte da verdade, recalculada a partir do
// produto/variante buscados no servidor) quanto pelo formulário (preview do
// total em tempo real). Uma fórmula, um lugar só.
// Ver docs/architecture/orcamentos-tecnicos.md.

export type ModoCalculo = "AREA" | "LINEAR" | "UNIDADE";

export interface CalcularItemInput {
  modoCalculo: ModoCalculo;
  precoBase: number;
  precoVariante?: number | null;
  larguraMm?: number | null;
  alturaMm?: number | null;
  comprimentoMm?: number | null;
  quantidade: number;
  acrescimoValor?: number | null;
}

export interface CalcularItemResult {
  precoCalculado: number;
  totalItem: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularItem(input: CalcularItemInput): CalcularItemResult {
  const precoUnitario = input.precoVariante ?? input.precoBase;
  let precoCalculado = 0;

  if (input.modoCalculo === "AREA") {
    const larguraM = (input.larguraMm ?? 0) / 1000;
    const alturaM = (input.alturaMm ?? 0) / 1000;
    precoCalculado = larguraM * alturaM * precoUnitario;
  } else if (input.modoCalculo === "LINEAR") {
    const comprimentoM = (input.comprimentoMm ?? 0) / 1000;
    precoCalculado = comprimentoM * precoUnitario;
  } else {
    precoCalculado = precoUnitario;
  }

  const acrescimo = input.acrescimoValor ?? 0;
  const totalItem = precoCalculado * input.quantidade + acrescimo;

  return { precoCalculado: round2(precoCalculado), totalItem: round2(totalItem) };
}

export interface CalcularOrcamentoResult {
  subtotal: number;
  desconto: number;
  valorTotal: number;
}

export function calcularOrcamento(
  totaisItens: number[],
  descontoPercentual?: number | null,
  descontoValor?: number | null
): CalcularOrcamentoResult {
  const subtotal = round2(totaisItens.reduce((acc, v) => acc + v, 0));
  const desconto = round2(
    descontoValor != null ? descontoValor : descontoPercentual ? (subtotal * descontoPercentual) / 100 : 0
  );
  const valorTotal = round2(subtotal - desconto);
  return { subtotal, desconto, valorTotal };
}

// Regra de dimensão exigida por modo de cálculo — usada pela validação da
// API (que conhece o modoCalculo real do produto) e pelo formulário.
export function dimensaoValidaParaModo(
  modoCalculo: ModoCalculo,
  larguraMm?: number | null,
  alturaMm?: number | null,
  comprimentoMm?: number | null
): boolean {
  if (modoCalculo === "AREA") return !!larguraMm && !!alturaMm;
  if (modoCalculo === "LINEAR") return !!comprimentoMm;
  return true;
}
