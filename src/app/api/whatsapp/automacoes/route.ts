import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, isAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { sanearAcoes, sanearGatilhoConfig } from "@/lib/whatsapp/automacoes";

export const dynamic = "force-dynamic";

const GATILHOS = ["CONTATO_NOVO", "MENSAGEM_RECEBIDA", "FORA_DO_HORARIO"] as const;

export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!hasPermission(payload.role, "whatsapp:use")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const automacoes = await prisma.whatsAppAutomacao.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ automacoes, podeEditar: isAdmin(payload.role) });
}

export async function POST(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!isAdmin(payload.role)) return NextResponse.json({ error: "Só Admin ou Dev" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome ?? "").trim();
  const gatilho = String(body.gatilho ?? "");
  if (!nome || !GATILHOS.includes(gatilho as (typeof GATILHOS)[number])) {
    return NextResponse.json({ error: "Nome e gatilho são obrigatórios" }, { status: 400 });
  }
  const acoes = sanearAcoes(body.acoes);
  if (!acoes || (acoes as unknown[]).length === 0) {
    return NextResponse.json({ error: "Adicione ao menos uma ação válida" }, { status: 400 });
  }

  const automacao = await prisma.whatsAppAutomacao.create({
    data: {
      nome: nome.slice(0, 80),
      gatilho: gatilho as (typeof GATILHOS)[number],
      gatilhoConfig: sanearGatilhoConfig(body.gatilhoConfig) ?? undefined,
      acoes,
      ativa: body.ativa !== false,
      sessaoId: typeof body.sessaoId === "string" && body.sessaoId ? body.sessaoId : null,
      criadoPorId: payload.userId,
    },
  });
  return NextResponse.json(automacao, { status: 201 });
}
