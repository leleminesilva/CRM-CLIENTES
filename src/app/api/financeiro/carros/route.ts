import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const incluirInativos = searchParams.get("todos") === "true";

  const carros = await prisma.financeiroCarro.findMany({
    where: incluirInativos ? {} : { ativo: true },
    include: {
      usos: {
        where: { chegadaEm: null },
        orderBy: { saidaEm: "desc" },
        take: 1,
        include: { motorista: { select: { id: true, nome: true } } },
      },
      _count: { select: { usos: true } },
    },
    orderBy: [{ ativo: "desc" }, { numero: "asc" }],
  });

  // Última km conhecida (chegada do último uso fechado, ou saída do uso aberto) — ajuda a
  // validar/preencher a próxima saída sem deixar a quilometragem "andar pra trás".
  const ultimasKm = await prisma.financeiroCarroUso.findMany({
    where: { chegadaEm: { not: null } },
    orderBy: { chegadaEm: "desc" },
    distinct: ["carroId"],
    select: { carroId: true, kmChegada: true },
  });
  const kmPorCarro = new Map(ultimasKm.map((u) => [u.carroId, u.kmChegada]));

  const data = carros.map((c) => {
    const usoAtual = c.usos[0] ?? null;
    const kmUltimaChegada = kmPorCarro.get(c.id) ?? null;
    return {
      id: c.id,
      numero: c.numero,
      modelo: c.modelo,
      ano: c.ano,
      placa: c.placa,
      cor: c.cor,
      ativo: c.ativo,
      totalUsos: c._count.usos,
      usoAtual: usoAtual
        ? { id: usoAtual.id, motorista: usoAtual.motorista, kmSaida: usoAtual.kmSaida, saidaEm: usoAtual.saidaEm }
        : null,
      kmAtual: usoAtual ? usoAtual.kmSaida : kmUltimaChegada,
    };
  });

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const existe = await prisma.financeiroCarro.findUnique({ where: { placa: parsed.data.placa.toUpperCase() } });
  if (existe) return NextResponse.json({ error: "Já existe um carro com essa placa" }, { status: 409 });

  const carro = await prisma.financeiroCarro.create({
    data: { ...parsed.data, placa: parsed.data.placa.toUpperCase() },
  });
  return NextResponse.json({ data: carro }, { status: 201 });
}
