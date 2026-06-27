import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Prefs {
  leadNovo?: boolean;
  tarefaVencendo?: boolean;
  oportunidadeParada?: boolean;
  clienteSemContato?: boolean;
}

// Avoid duplicate notifications: check if one already exists in a given window
async function notifExists(userId: string, tipo: string, linkUrl: string, windowMs: number) {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.notificacao.count({
    where: { userId, tipo: tipo as never, linkUrl, createdAt: { gte: since } },
  });
  return count > 0;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const user = await prisma.user.findFirst({
      where: { id: payload.userId, deletedAt: null },
      select: { id: true, prefsNotificacao: true },
    });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    const prefs: Prefs = (user.prefsNotificacao as Prefs) ?? {
      leadNovo: true,
      tarefaVencendo: true,
      oportunidadeParada: true,
      clienteSemContato: true,
    };

    const created: string[] = [];

    // ── 1. LEAD_NOVO: leads atribuídos a mim nos últimos 7 dias ─────────────
    if (prefs.leadNovo !== false) {
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const leadsNovos = await prisma.lead.findMany({
        where: {
          responsavelId: payload.userId,
          deletedAt: null,
          createdAt: { gte: since7d },
        },
        select: { id: true, titulo: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });

      for (const lead of leadsNovos) {
        const linkUrl = `/leads?id=${lead.id}`;
        const already = await notifExists(payload.userId, "LEAD_NOVO", linkUrl, 7 * 24 * 60 * 60 * 1000);
        if (!already) {
          await prisma.notificacao.create({
            data: {
              userId: payload.userId,
              tipo: "LEAD_NOVO",
              titulo: "Novo lead atribuído",
              mensagem: `O lead "${lead.titulo}" foi atribuído a você.`,
              linkUrl,
            },
          });
          created.push("LEAD_NOVO:" + lead.id);
        }
      }
    }

    // ── 2. TAREFA_VENCENDO: tarefas vencendo em até 24h ────────────────────
    if (prefs.tarefaVencendo !== false) {
      const now = new Date();
      const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const tarefas = await prisma.tarefa.findMany({
        where: {
          responsavelId: payload.userId,
          deletedAt: null,
          status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
          dataVencimento: { gte: now, lte: in24h },
        },
        select: { id: true, titulo: true, dataVencimento: true },
      });

      for (const t of tarefas) {
        const linkUrl = `/tarefas?id=${t.id}`;
        const already = await notifExists(payload.userId, "TAREFA_VENCENDO", linkUrl, 20 * 60 * 60 * 1000);
        if (!already) {
          const hora = t.dataVencimento.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          await prisma.notificacao.create({
            data: {
              userId: payload.userId,
              tipo: "TAREFA_VENCENDO",
              titulo: "Tarefa vencendo em breve",
              mensagem: `"${t.titulo}" vence hoje às ${hora}. Não esqueça!`,
              linkUrl,
            },
          });
          created.push("TAREFA_VENCENDO:" + t.id);
        }
      }
    }

    // ── 3. OPORTUNIDADE_PARADA: sem movimentação por 7 dias ────────────────
    if (prefs.oportunidadeParada !== false) {
      const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const opps = await prisma.oportunidade.findMany({
        where: {
          responsavelId: payload.userId,
          deletedAt: null,
          status: "ABERTA",
          updatedAt: { lte: cutoff7d },
        },
        select: { id: true, titulo: true, updatedAt: true },
        take: 10,
      });

      for (const opp of opps) {
        const linkUrl = `/oportunidades?id=${opp.id}`;
        const already = await notifExists(payload.userId, "OPORTUNIDADE_PARADA", linkUrl, 24 * 60 * 60 * 1000);
        if (!already) {
          const days = Math.floor((Date.now() - opp.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
          await prisma.notificacao.create({
            data: {
              userId: payload.userId,
              tipo: "OPORTUNIDADE_PARADA",
              titulo: "Oportunidade sem movimentação",
              mensagem: `"${opp.titulo}" está parada há ${days} dias sem atualização.`,
              linkUrl,
            },
          });
          created.push("OPORTUNIDADE_PARADA:" + opp.id);
        }
      }
    }

    // ── 4. CLIENTE_SEM_CONTATO: sem contato há 30 dias ─────────────────────
    if (prefs.clienteSemContato !== false) {
      const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const clientes = await prisma.cliente.findMany({
        where: {
          responsavelId: payload.userId,
          deletedAt: null,
          updatedAt: { lte: cutoff30d },
        },
        select: { id: true, nome: true, updatedAt: true },
        take: 10,
        orderBy: { updatedAt: "asc" },
      });

      for (const c of clientes) {
        const link = `/clientes/${c.id}`;
        const already = await notifExists(payload.userId, "CLIENTE_SEM_CONTATO", link, 7 * 24 * 60 * 60 * 1000);
        if (!already) {
          const days = Math.floor((Date.now() - c.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
          await prisma.notificacao.create({
            data: {
              userId: payload.userId,
              tipo: "CLIENTE_SEM_CONTATO",
              titulo: "Cliente sem contato",
              mensagem: `${c.nome} está há ${days} dias sem contato. Que tal ligar?`,
              linkUrl: `/clientes/${c.id}`,
            },
          });
          created.push("CLIENTE_SEM_CONTATO:" + c.id);
        }
      }
    }

    return NextResponse.json({ created });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar notificações" }, { status: 500 });
  }
}
