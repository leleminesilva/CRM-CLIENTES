import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireFinanceiroAccess } from "@/lib/financeiro/authz";
import { carroUsoChegadaSchema } from "@/lib/validators/financeiro";

export const dynamic = "force-dynamic";

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
