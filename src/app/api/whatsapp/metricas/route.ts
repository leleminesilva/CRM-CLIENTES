import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// KPIs do módulo de atendimento. Mesmo escopo da fila: quem não é Admin/Dev
// só conta as conversas de sessões atribuídas a ele.
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const escopo: Prisma.WhatsAppConversaWhereInput = isAdmin(payload.role)
    ? {}
    : { sessao: { atendenteId: payload.userId } };

  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const seteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [emAberto, naoAtribuidas, resolvidasHoje, fechados7d, novas7d, recentes] = await Promise.all([
    prisma.whatsAppConversa.count({ where: { ...escopo, status: { in: ["ABERTA", "PENDENTE"] } } }),
    prisma.whatsAppConversa.count({
      where: { ...escopo, responsavelId: null, status: { not: "RESOLVIDA" } },
    }),
    prisma.whatsAppConversa.count({
      where: { ...escopo, status: "RESOLVIDA", updatedAt: { gte: inicioHoje } },
    }),
    prisma.whatsAppConversa.count({
      where: { ...escopo, etapa: "FECHADO", updatedAt: { gte: seteDias } },
    }),
    prisma.whatsAppConversa.count({ where: { ...escopo, createdAt: { gte: seteDias } } }),
    // Amostra pra tempo de 1ª resposta: conversas com atividade nas últimas 24h
    prisma.whatsAppConversa.findMany({
      where: { ...escopo, ultimaMsgEm: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: {
        id: true,
        mensagens: { orderBy: { enviadaEm: "asc" }, select: { direcao: true, enviadaEm: true } },
      },
      take: 200,
    }),
  ]);

  // Tempo médio entre a 1ª mensagem do cliente e a 1ª resposta do atendente.
  const deltas: number[] = [];
  for (const c of recentes) {
    const primeiroCliente = c.mensagens.find((m) => m.direcao === "entrada");
    if (!primeiroCliente) continue;
    const primeiraResposta = c.mensagens.find(
      (m) => m.direcao === "saida" && m.enviadaEm > primeiroCliente.enviadaEm
    );
    if (!primeiraResposta) continue;
    deltas.push(primeiraResposta.enviadaEm.getTime() - primeiroCliente.enviadaEm.getTime());
  }
  const primeiraRespostaMs = deltas.length
    ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length)
    : null;

  return NextResponse.json({
    emAberto,
    naoAtribuidas,
    resolvidasHoje,
    primeiraRespostaMs,
    conversao7d: novas7d ? Math.round((fechados7d / novas7d) * 100) : null,
  });
}
