import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { emit } from "@/lib/whatsapp/events";
import { formatBrazilianPhone } from "@/lib/utils/phone";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Vincula a conversa a um Cliente do CRM:
//   { acao: "criar" }            → cria um Cliente a partir do contato e vincula
//   { acao: "desvincular" }      → solta o vínculo
//   { clienteId: "..." }         → vincula a um Cliente existente
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const conversa = await prisma.whatsAppConversa.findUnique({
    where: { id: params.id },
    include: { sessao: { select: { atendenteId: true } } },
  });
  if (!conversa) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  if (!isAdmin(payload.role) && conversa.sessao.atendenteId !== payload.userId) {
    return NextResponse.json({ error: "Você não tem acesso a esta conversa" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  let clienteId: string | null;

  if (body.acao === "desvincular") {
    clienteId = null;
  } else if (body.acao === "criar") {
    const nome = conversa.contatoNome?.trim() || formatBrazilianPhone(conversa.contatoPhone);
    const cliente = await prisma.cliente.create({
      data: {
        nome,
        whatsapp: formatBrazilianPhone(conversa.contatoPhone),
        origem: "WHATSAPP",
      },
    });
    await createAuditLog({
      userId: payload.userId,
      entidade: "Cliente",
      entidadeId: cliente.id,
      acao: "CREATE",
      dadosNovos: { nome, origem: "WHATSAPP", viaConversaWhatsApp: params.id },
    });
    clienteId = cliente.id;
  } else if (typeof body.clienteId === "string" && body.clienteId) {
    const existe = await prisma.cliente.findFirst({
      where: { id: body.clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!existe) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    clienteId = body.clienteId;
  } else {
    return NextResponse.json({ error: "Informe clienteId ou acao" }, { status: 400 });
  }

  await prisma.whatsAppConversa.update({ where: { id: params.id }, data: { clienteId } });
  await emit("ConversationUpdated", { conversaId: params.id }, params.id);

  return NextResponse.json({ ok: true, clienteId });
}
