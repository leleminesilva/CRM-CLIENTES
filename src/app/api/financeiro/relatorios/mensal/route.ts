import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const agora = new Date();
  const ano = Number(searchParams.get("ano") ?? agora.getFullYear());
  const mes = Number(searchParams.get("mes") ?? agora.getMonth() + 1); // 1-12

  const inicioMes = new Date(ano, mes - 1, 1);
  const fimMes = new Date(ano, mes, 0, 23, 59, 59, 999);

  const [contas, lancamentosAnteriores, lancamentosMes] = await Promise.all([
    prisma.financeiroConta.findMany({ select: { id: true, saldoInicial: true } }),
    prisma.financeiroLancamento.findMany({
      where: { data: { lt: inicioMes } },
      select: { tipo: true, valor: true },
    }),
    prisma.financeiroLancamento.findMany({
      where: { data: { gte: inicioMes, lte: fimMes } },
      include: {
        conta: { select: { id: true, nome: true, cor: true } },
        categoria: { select: { id: true, nome: true, cor: true } },
      },
      orderBy: { data: "asc" },
    }),
  ]);

  const saldoInicialContas = contas.reduce((s, c) => s + Number(c.saldoInicial), 0);
  const saldoAcumuladoAnterior = lancamentosAnteriores.reduce(
    (s, l) => s + (l.tipo === "ENTRADA" ? Number(l.valor) : -Number(l.valor)),
    saldoInicialContas
  );

  const entradas = lancamentosMes.filter((l) => l.tipo === "ENTRADA");
  const saidas = lancamentosMes.filter((l) => l.tipo === "SAIDA");
  const totalEntradas = entradas.reduce((s, l) => s + Number(l.valor), 0);
  const totalSaidas = saidas.reduce((s, l) => s + Number(l.valor), 0);

  function agruparPorCategoria(lista: typeof lancamentosMes) {
    const mapa = new Map<string, { categoriaId: string | null; nome: string; cor: string | null; total: number }>();
    for (const l of lista) {
      const chave = l.categoriaId ?? "sem-categoria";
      const atual = mapa.get(chave) ?? {
        categoriaId: l.categoriaId,
        nome: l.categoria?.nome ?? "Sem categoria",
        cor: l.categoria?.cor ?? null,
        total: 0,
      };
      atual.total += Number(l.valor);
      mapa.set(chave, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }

  return NextResponse.json({
    data: {
      ano,
      mes,
      saldoInicial: saldoAcumuladoAnterior,
      saldoFinal: saldoAcumuladoAnterior + totalEntradas - totalSaidas,
      totalEntradas,
      totalSaidas,
      resultado: totalEntradas - totalSaidas,
      entradasPorCategoria: agruparPorCategoria(entradas),
      saidasPorCategoria: agruparPorCategoria(saidas),
      lancamentos: lancamentosMes,
    },
  });
}
