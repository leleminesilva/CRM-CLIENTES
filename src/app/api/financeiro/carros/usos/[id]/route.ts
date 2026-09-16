import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroUsoChegadaSchema, carroUsoCombustivelSchema } from "@/lib/validators/financeiro";
import { criarLancamentoCombustivel } from "@/lib/financeiro/combustivel";

export const dynamic = "force-dynamic";

// Registrar (ou corrigir) o valor de gasolina de um uso já criado — não precisa
// esperar a chegada, dá pra usar a qualquer momento depois da saída registrada.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = carroUsoCombustivelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }

  const uso = await prisma.financeiroCarroUso.findUnique({
    where: { id: params.id },
    include: { carro: true, motorista: true },
  });
  if (!uso) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  const conta = await prisma.financeiroConta.findUnique({ where: { id: parsed.data.contaCombustivelId } });
  if (!conta || !conta.ativa) return NextResponse.json({ error: "Conta inválida ou arquivada" }, { status: 400 });

  const atualizado = await prisma.$transaction(async (tx) => {
    if (uso.lancamentoCombustivelId) {
      await tx.financeiroLancamento.update({
        where: { id: uso.lancamentoCombustivelId },
        data: { valor: parsed.data.valorCombustivel, contaId: parsed.data.contaCombustivelId },
      });
      return tx.financeiroCarroUso.update({
        where: { id: uso.id },
        data: { valorCombustivel: parsed.data.valorCombustivel },
        include: {
          carro: { select: { id: true, numero: true, modelo: true, placa: true } },
          motorista: { select: { id: true, nome: true } },
        },
      });
    }

    const lancamento = await criarLancamentoCombustivel(tx, {
      contaId: parsed.data.contaCombustivelId,
      valor: parsed.data.valorCombustivel,
      descricao: `Combustível — ${uso.carro.numero} · ${uso.carro.modelo} (${uso.motorista.nome})`,
      criadoPorId: auth.payload.userId,
    });
    return tx.financeiroCarroUso.update({
      where: { id: uso.id },
      data: { valorCombustivel: parsed.data.valorCombustivel, lancamentoCombustivelId: lancamento.id },
      include: {
        carro: { select: { id: true, numero: true, modelo: true, placa: true } },
        motorista: { select: { id: true, nome: true } },
      },
    });
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

  const atualizado = await prisma.financeiroCarroUso.update({
    where: { id: params.id },
    data: {
      kmChegada: parsed.data.kmChegada,
      chegadaEm: new Date(),
      observacoes: parsed.data.observacoes || uso.observacoes,
    },
    include: {
      carro: { select: { id: true, numero: true, modelo: true, placa: true } },
      motorista: { select: { id: true, nome: true } },
    },
  });

  return NextResponse.json({ data: atualizado });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceiroAccess(request);
  if (!auth.ok) return auth.response;

  await prisma.financeiroCarroUso.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
