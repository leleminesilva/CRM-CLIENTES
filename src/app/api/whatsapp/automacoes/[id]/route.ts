import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { sanearAcoes, sanearGatilhoConfig } from "@/lib/whatsapp/automacoes";

export const dynamic = "force-dynamic";

const GATILHOS = ["CONTATO_NOVO", "MENSAGEM_RECEBIDA", "FORA_DO_HORARIO"];

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const existe = await prisma.whatsAppAutomacao.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existe) return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data: Prisma.WhatsAppAutomacaoUpdateInput = {};

  if (typeof body.ativa === "boolean") data.ativa = body.ativa;
  if (typeof body.nome === "string" && body.nome.trim()) data.nome = body.nome.trim().slice(0, 80);
  if (typeof body.gatilho === "string" && GATILHOS.includes(body.gatilho)) {
    data.gatilho = body.gatilho as "CONTATO_NOVO" | "MENSAGEM_RECEBIDA" | "FORA_DO_HORARIO";
  }
  if ("gatilhoConfig" in body) data.gatilhoConfig = sanearGatilhoConfig(body.gatilhoConfig) ?? Prisma.JsonNull;
  if ("acoes" in body) {
    const acoes = sanearAcoes(body.acoes);
    if (!acoes || (acoes as unknown[]).length === 0) {
      return NextResponse.json({ error: "Adicione ao menos uma ação válida" }, { status: 400 });
    }
    data.acoes = acoes;
  }
  if ("sessaoId" in body) {
    data.sessaoId = typeof body.sessaoId === "string" && body.sessaoId ? body.sessaoId : null;
  }

  const automacao = await prisma.whatsAppAutomacao.update({ where: { id: params.id }, data });
  return NextResponse.json(automacao);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  await prisma.whatsAppAutomacao.delete({ where: { id: params.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
