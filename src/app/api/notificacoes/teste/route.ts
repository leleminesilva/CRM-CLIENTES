import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Only ADMINISTRADOR/DESENVOLVEDOR can call this endpoint
export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    if (!isAdmin(payload.role)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    await prisma.notificacao.createMany({
      data: [
        {
          userId: payload.userId,
          tipo: "LEAD_NOVO",
          titulo: "Novo lead atribuído",
          mensagem: "O lead \"Projeto Fachada Comercial\" foi atribuído a você.",
          linkUrl: "/leads",
          lida: false,
        },
        {
          userId: payload.userId,
          tipo: "TAREFA_VENCENDO",
          titulo: "Tarefa vencendo em breve",
          mensagem: "\"Ligação de follow-up\" vence hoje. Não esqueça!",
          linkUrl: "/tarefas",
          lida: false,
        },
        {
          userId: payload.userId,
          tipo: "OPORTUNIDADE_PARADA",
          titulo: "Oportunidade sem movimentação",
          mensagem: "\"Box banheiro Residencial\" está parada há 8 dias sem atualização.",
          linkUrl: "/oportunidades",
          lida: false,
        },
        {
          userId: payload.userId,
          tipo: "CLIENTE_SEM_CONTATO",
          titulo: "Cliente sem contato",
          mensagem: "Um cliente está há 32 dias sem contato. Que tal ligar?",
          linkUrl: "/clientes",
          lida: false,
        },
      ],
    });

    return NextResponse.json({ message: "Notificações de teste criadas com sucesso" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao criar notificações de teste" }, { status: 500 });
  }
}
