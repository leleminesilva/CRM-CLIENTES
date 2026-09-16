import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroUsoChegadaSchema, carroUsoEditSchema } from "@/lib/validators/financeiro";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const usoInclude = {
  carro: { select: { id: true, numero: true, modelo: true, placa: true } },
  motorista: { select: { id: true, nome: true } },
} as const;

// <input type="datetime-local"> só tem precisão de minuto — comparar por
// milissegundo contra um horário gravado com segundos (ex: gerado por
// new Date()) sempre acusaria mudança mesmo quando ninguém mexeu no campo.
function mesmoMinuto(a: Date | null, b: Date | null) {
  if (a == null || b == null) return a === b;
  return Math.floor(a.getTime() / 60000) === Math.floor(b.getTime() / 60000);
}

// Corrige um registro do histórico já existente (carro, motorista, km, horários,
// observações) — quem registra sempre chega depois do carro sair/voltar, então
// erros de digitação só aparecem depois. Valor de gasolina fica de fora daqui,
// tem rota própria (.../combustivel) porque também mexe num lançamento do Caixa.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroUsoEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const atual = await prisma.financeiroCarroUso.findUnique({ where: { id: params.id }, include: usoInclude });
  if (!atual) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const antigo: Record<string, unknown> = {};
  const novo: Record<string, unknown> = {};
  let carroLabel = `${atual.carro.numero} · ${atual.carro.modelo}`;
  let motoristaLabel = atual.motorista.nome;

  if (parsed.data.carroId && parsed.data.carroId !== atual.carroId) {
    const carro = await prisma.financeiroCarro.findUnique({ where: { id: parsed.data.carroId } });
    if (!carro) return NextResponse.json({ error: "Carro inválido" }, { status: 400 });
    data.carroId = carro.id;
    antigo.carro = carroLabel;
    carroLabel = `${carro.numero} · ${carro.modelo}`;
    novo.carro = carroLabel;
  }
  if (parsed.data.motoristaId && parsed.data.motoristaId !== atual.motoristaId) {
    const motorista = await prisma.financeiroMotorista.findUnique({ where: { id: parsed.data.motoristaId } });
    if (!motorista) return NextResponse.json({ error: "Motorista inválido" }, { status: 400 });
    data.motoristaId = motorista.id;
    antigo.motorista = motoristaLabel;
    motoristaLabel = motorista.nome;
    novo.motorista = motoristaLabel;
  }
  if (parsed.data.kmSaida != null && parsed.data.kmSaida !== atual.kmSaida) {
    data.kmSaida = parsed.data.kmSaida;
    antigo.kmSaida = atual.kmSaida;
    novo.kmSaida = parsed.data.kmSaida;
  }
  if (parsed.data.saidaEm) {
    const d = new Date(parsed.data.saidaEm);
    if (!mesmoMinuto(d, atual.saidaEm)) {
      data.saidaEm = d;
      antigo.saidaEm = atual.saidaEm;
      novo.saidaEm = d;
    }
  }
  if (parsed.data.kmChegada !== undefined && parsed.data.kmChegada !== atual.kmChegada) {
    data.kmChegada = parsed.data.kmChegada;
    antigo.kmChegada = atual.kmChegada;
    novo.kmChegada = parsed.data.kmChegada;
  }
  if (parsed.data.chegadaEm !== undefined) {
    const d = parsed.data.chegadaEm ? new Date(parsed.data.chegadaEm) : null;
    if (!mesmoMinuto(d, atual.chegadaEm)) {
      data.chegadaEm = d;
      antigo.chegadaEm = atual.chegadaEm;
      novo.chegadaEm = d;
    }
  }
  if (parsed.data.observacoes !== undefined && (parsed.data.observacoes || null) !== atual.observacoes) {
    data.observacoes = parsed.data.observacoes || null;
    antigo.observacoes = atual.observacoes;
    novo.observacoes = data.observacoes;
  }

  const kmSaidaFinal = (data.kmSaida as number | undefined) ?? atual.kmSaida;
  const kmChegadaFinal = "kmChegada" in data ? (data.kmChegada as number | null) : atual.kmChegada;
  if (kmChegadaFinal != null && kmChegadaFinal < kmSaidaFinal) {
    return NextResponse.json({ error: `Km de chegada não pode ser menor que a de saída (${kmSaidaFinal} km)` }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ data: atual });
  }

  const atualizado = await prisma.financeiroCarroUso.update({ where: { id: params.id }, data, include: usoInclude });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroCarroUso",
    entidadeId: params.id,
    acao: "UPDATE",
    dadosAntigos: antigo,
    dadosNovos: novo,
  });

  return NextResponse.json({ data: atualizado });
}

// Registrar a chegada (quilometragem de volta) de um uso em aberto.
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroUsoChegadaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const uso = await prisma.financeiroCarroUso.findUnique({ where: { id: params.id } });
  if (!uso) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });
  if (uso.chegadaEm) return NextResponse.json({ error: "Chegada já registrada para esse uso" }, { status: 409 });
  if (parsed.data.kmChegada < uso.kmSaida) {
    return NextResponse.json({ error: `Quilometragem de chegada não pode ser menor que a de saída (${uso.kmSaida} km)` }, { status: 400 });
  }

  const chegadaEm = new Date();
  const atualizado = await prisma.financeiroCarroUso.update({
    where: { id: params.id },
    data: {
      kmChegada: parsed.data.kmChegada,
      chegadaEm,
      observacoes: parsed.data.observacoes || uso.observacoes,
    },
    include: usoInclude,
  });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroCarroUso",
    entidadeId: params.id,
    acao: "UPDATE",
    dadosAntigos: { kmChegada: uso.kmChegada, chegadaEm: uso.chegadaEm },
    dadosNovos: { kmChegada: parsed.data.kmChegada, chegadaEm },
  });

  return NextResponse.json({ data: atualizado });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const uso = await prisma.financeiroCarroUso.delete({ where: { id: params.id }, include: usoInclude }).catch(() => null);
  if (!uso) return NextResponse.json({ ok: true });

  await createAuditLog({
    userId: auth.payload.userId,
    entidade: "FinanceiroCarroUso",
    entidadeId: params.id,
    acao: "DELETE",
    dadosAntigos: {
      carro: `${uso.carro.numero} · ${uso.carro.modelo}`,
      motorista: uso.motorista.nome,
      kmSaida: uso.kmSaida,
      saidaEm: uso.saidaEm,
    },
  });

  return NextResponse.json({ ok: true });
}
