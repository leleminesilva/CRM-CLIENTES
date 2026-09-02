import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const sessaoId = searchParams.get("sessaoId");

  // Escopo por atendente: quem não pode ver tudo só enxerga conversas de
  // sessões atribuídas a ele. Um sessaoId de sessão alheia degrada pra
  // conjunto vazio (mesmo padrão de responsavelId em clientes/route.ts) —
  // não precisa de 403 aqui, só a permissão de módulo já é checada acima.
  const conversas = await prisma.whatsAppConversa.findMany({
    where: {
      ...(sessaoId ? { sessaoId } : {}),
      ...(isAdmin(payload.role) ? {} : { sessao: { atendenteId: payload.userId } }),
    },
    orderBy: { ultimaMsgEm: "desc" },
    include: {
      mensagens: {
        orderBy: { enviadaEm: "desc" },
        take: 1,
      },
      agentEstado: { select: { estado: true } },
    },
  });

  // Anexa o Cliente vinculado (clienteId é campo solto, sem @relation no
  // schema — junção manual por id pra não exigir migration). Ver
  // docs/architecture/whatsapp-crm-integracao.md.
  const clienteIds = Array.from(
    new Set(conversas.map((c) => c.clienteId).filter((v): v is string => !!v))
  );
  const clientes = clienteIds.length
    ? await prisma.cliente.findMany({
        where: { id: { in: clienteIds } },
        select: { id: true, nome: true, cidade: true, estado: true, telefone: true, whatsapp: true },
      })
    : [];
  const porId = new Map(clientes.map((c) => [c.id, c]));

  return NextResponse.json(
    conversas.map((c) => ({
      ...c,
      cliente: c.clienteId ? porId.get(c.clienteId) ?? null : null,
    }))
  );
}
