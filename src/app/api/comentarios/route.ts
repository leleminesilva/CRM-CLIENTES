import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  texto: z.string().min(1),
  clienteId: z.string().optional(),
  leadId: z.string().optional(),
  oportunidadeId: z.string().optional(),
  contatoId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const data = schema.parse(body);

    const comentario = await prisma.comentario.create({
      data: { ...data, userId: payload.userId },
      include: { user: { select: { id: true, nome: true, avatar: true } } },
    });

    await prisma.atividade.create({
      data: {
        tipo: "COMENTARIO",
        descricao: `Comentário adicionado`,
        userId: payload.userId,
        clienteId: data.clienteId,
        leadId: data.leadId,
        oportunidadeId: data.oportunidadeId,
        contatoId: data.contatoId,
      },
    });

    return NextResponse.json({ data: comentario }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar comentário" }, { status: 500 });
  }
}
