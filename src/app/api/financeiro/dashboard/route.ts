import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";

export const dynamic = "force-dynamic";

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59, 999);
  const inicioSerie = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);

  const [contas, somaPorConta, resumoMesAtual, resumoMesAnterior, lancamentosSerie, ultimosLancamentos] = await Promise.all([
    prisma.financeiroConta.findMany({ where: { ativa: true }, orderBy: { nome: "asc" } }),
    prisma.financeiroLancamento.groupBy({ by: ["contaId", "tipo"], _sum: { valor: true } }),
    prisma.financeiroLancamento.groupBy({
      by: ["tipo"],
      where: { data: { gte: inicioMesAtual, lte: fimMesAtual } },
      _sum: { valor: true },
    }),
    prisma.financeiroLancamento.groupBy({
      by: ["tipo"],
      where: { data: { gte: inicioMesAnterior, lte: fimMesAnterior } },
      _sum: { valor: true },
    }),
    prisma.financeiroLancamento.findMany({
      where: { data: { gte: inicioSerie } },
      select: { data: true, tipo: true, valor: true },
    }),
    prisma.financeiroLancamento.findMany({
      orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      take: 8,
      include: {
        conta: { select: { id: true, nome: true, cor: true } },
        categoria: { select: { id: true, nome: true, cor: true } },
      },
    }),
  ]);

  const saldoPorConta = new Map<string, number>();
  for (const c of contas) saldoPorConta.set(c.id, Number(c.saldoInicial));
  for (const linha of somaPorConta) {
    const atual = saldoPorConta.get(linha.contaId) ?? 0;
    const valor = Number(linha._sum.valor ?? 0);
    saldoPorConta.set(linha.contaId, atual + (linha.tipo === "ENTRADA" ? valor : -valor));
  }

  const contasComSaldo = contas.map((c) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    cor: c.cor,
    saldo: saldoPorConta.get(c.id) ?? 0,
  }));

  const somaResumo = (resumo: typeof resumoMesAtual, tipo: "ENTRADA" | "SAIDA") =>
    Number(resumo.find((r) => r.tipo === tipo)?._sum.valor ?? 0);

  const entradasMes = somaResumo(resumoMesAtual, "ENTRADA");
  const saidasMes = somaResumo(resumoMesAtual, "SAIDA");
  const entradasMesAnterior = somaResumo(resumoMesAnterior, "ENTRADA");
  const saidasMesAnterior = somaResumo(resumoMesAnterior, "SAIDA");

  const serieMap = new Map<string, { mes: string; entradas: number; saidas: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    serieMap.set(chaveMes(d), { mes: chaveMes(d), entradas: 0, saidas: 0 });
  }
  for (const l of lancamentosSerie) {
    const chave = chaveMes(new Date(l.data));
    const bucket = serieMap.get(chave);
    if (!bucket) continue;
    if (l.tipo === "ENTRADA") bucket.entradas += Number(l.valor);
    else bucket.saidas += Number(l.valor);
  }

  return NextResponse.json({
    data: {
      saldoTotal: contasComSaldo.reduce((s, c) => s + c.saldo, 0),
      contas: contasComSaldo,
      mesAtual: { entradas: entradasMes, saidas: saidasMes, saldo: entradasMes - saidasMes },
      mesAnterior: { entradas: entradasMesAnterior, saidas: saidasMesAnterior, saldo: entradasMesAnterior - saidasMesAnterior },
      serie: Array.from(serieMap.values()),
      ultimosLancamentos,
    },
  });
}
