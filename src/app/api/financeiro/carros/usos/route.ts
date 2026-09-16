import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroUsoSaidaSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const carroId = searchParams.get("carroId");
  const motoristaId = searchParams.get("motoristaId");
  const aberto = searchParams.get("aberto");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "20")));

  const where: Record<string, unknown> = {};
  if (carroId) where.carroId = carroId;
  if (motoristaId) where.motoristaId = motoristaId;
  if (aberto === "true") where.chegadaEm = null;
  if (aberto === "false") where.chegadaEm = { not: null };
  if (de || ate) {
    where.saidaEm = {
      ...(de ? { gte: new Date(`${de}T00:00:00`) } : {}),
      ...(ate ? { lte: new Date(`${ate}T23:59:59`) } : {}),
    };
  }

  const [usos, total] = await Promise.all([
    prisma.financeiroCarroUso.findMany({
      where,
      include: {
        carro: { select: { id: true, numero: true, modelo: true, placa: true } },
        motorista: { select: { id: true, nome: true } },
        registradoPor: { select: { id: true, nome: true } },
      },
      orderBy: { saidaEm: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.financeiroCarroUso.count({ where }),
  ]);

  return NextResponse.json({ data: usos, total, page, limit });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroUsoSaidaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const carro = await prisma.financeiroCarro.findUnique({ where: { id: parsed.data.carroId } });
  if (!carro || !carro.ativo) return NextResponse.json({ error: "Carro inválido ou arquivado" }, { status: 400 });

  const motorista = await prisma.financeiroMotorista.findUnique({ where: { id: parsed.data.motoristaId } });
  if (!motorista || !motorista.ativo) return NextResponse.json({ error: "Motorista inválido ou arquivado" }, { status: 400 });

  const abertoExistente = await prisma.financeiroCarroUso.findFirst({ where: { carroId: carro.id, chegadaEm: null } });
  if (abertoExistente) return NextResponse.json({ error: "Esse carro já está em uso — registre a chegada antes de uma nova saída" }, { status: 409 });

  const ultimo = await prisma.financeiroCarroUso.findFirst({
    where: { carroId: carro.id, chegadaEm: { not: null } },
    orderBy: { chegadaEm: "desc" },
    select: { kmChegada: true },
  });
  if (ultimo?.kmChegada != null && parsed.data.kmSaida < ultimo.kmChegada) {
    return NextResponse.json({ error: `Quilometragem menor que a última registrada (${ultimo.kmChegada} km)` }, { status: 400 });
  }

  if (parsed.data.valorCombustivel && parsed.data.contaCombustivelId) {
    const conta = await prisma.financeiroConta.findUnique({ where: { id: parsed.data.contaCombustivelId } });
    if (!conta || !conta.ativa) return NextResponse.json({ error: "Conta da gasolina inválida ou arquivada" }, { status: 400 });
  }

  const uso = await prisma.$transaction(async (tx) => {
    let lancamentoCombustivelId: string | null = null;
    if (parsed.data.valorCombustivel && parsed.data.contaCombustivelId) {
      const categoria = await tx.financeiroCategoria.upsert({
        where: { nome_tipo: { nome: "Combustível", tipo: "SAIDA" } },
        update: {},
        create: { nome: "Combustível", tipo: "SAIDA", cor: "#0ea5e9", padrao: true },
      });
      const lancamento = await tx.financeiroLancamento.create({
        data: {
          contaId: parsed.data.contaCombustivelId,
          categoriaId: categoria.id,
          tipo: "SAIDA",
          descricao: `Combustível — ${carro.numero} · ${carro.modelo} (${motorista.nome})`,
          valor: parsed.data.valorCombustivel,
          data: new Date(),
          criadoPorId: auth.payload.userId,
        },
      });
      lancamentoCombustivelId = lancamento.id;
    }

    return tx.financeiroCarroUso.create({
      data: {
        carroId: carro.id,
        motoristaId: motorista.id,
        kmSaida: parsed.data.kmSaida,
        observacoes: parsed.data.observacoes || null,
        registradoPorId: auth.payload.userId,
        valorCombustivel: parsed.data.valorCombustivel ?? null,
        lancamentoCombustivelId,
      },
      include: {
        carro: { select: { id: true, numero: true, modelo: true, placa: true } },
        motorista: { select: { id: true, nome: true } },
      },
    });
  });

  return NextResponse.json({ data: uso }, { status: 201 });
}
