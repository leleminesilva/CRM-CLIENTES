import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const moverSchema = z.object({
  estagio: z.enum([
    "NOVO_LEAD",
    "CONTATO_INICIAL",
    "PRIMEIRO_ORCAMENTO",
    "QUALIFICACAO",
    "PROPOSTA_ENVIADA",
    "NEGOCIACAO",
    "FECHADO_GANHO",
    "FECHADO_PERDIDO",
  ]),
  ordemKanban: z.number().optional(),
  motivoPerda: z.string().optional(),
  dataFechamento: z.string().optional(), // YYYY-MM-DD, obrigatório no front para fechamentos
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    requirePermission(payload.role, "leads:update");

    const body = await request.json();
    const { estagio, ordemKanban, motivoPerda, dataFechamento } = moverSchema.parse(body);

    if (estagio === "FECHADO_PERDIDO" && !dataFechamento) {
      return NextResponse.json({ error: "Data do cancelamento é obrigatória" }, { status: 400 });
    }
    const isFechamento = estagio === "FECHADO_GANHO" || estagio === "FECHADO_PERDIDO";

    const old = await prisma.lead.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!old) return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });

    const lead = await prisma.lead.update({
      where: { id: params.id },
      data: {
        estagio,
        ordemKanban: ordemKanban ?? old.ordemKanban,
        motivoPerda: motivoPerda ?? old.motivoPerda,
        dataFechamento: isFechamento
          ? dataFechamento
            ? new Date(`${dataFechamento}T12:00:00`)
            : new Date()
          : null,
      },
    });

    if (old.estagio !== estagio) {
      await prisma.atividade.create({
        data: {
          tipo: "ESTAGIO_ALTERADO",
          descricao: `Estágio alterado de "${old.estagio}" para "${estagio}"`,
          userId: payload.userId,
          leadId: params.id,
          metadata: { de: old.estagio, para: estagio },
        },
      });
    }

    return NextResponse.json({ data: lead });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro ao mover lead" }, { status: 500 });
  }
}
