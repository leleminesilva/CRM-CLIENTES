import prisma from "@/lib/prisma";
import type { WhatsAppConversa, WhatsAppSessao, Prisma } from "@prisma/client";
import { sendWhatsAppMessage } from "./send";
import { emit } from "./events";
import { hasPermission } from "@/lib/rbac";
import { paraJidNumero } from "@/lib/utils/phone";
import { waLogger } from "./logger";

// Motor de automações: gatilho -> ações. Roda dentro do pipeline de eventos
// (handlers.ts, no MessageReceived). É event-driven — gatilhos por tempo
// (ex: "sem resposta há 24h") entram numa fase futura com agendador.
// Ver docs/architecture/whatsapp-crm-integracao.md.

type ConversaComSessao = WhatsAppConversa & { sessao: WhatsAppSessao };

const STATUS = ["ABERTA", "PENDENTE", "RESOLVIDA"] as const;

export type AcaoAutomacao =
  | { tipo: "ENVIAR_MENSAGEM"; texto: string }
  | { tipo: "MOVER_ETAPA"; etapa: string }
  | { tipo: "DEFINIR_STATUS"; status: (typeof STATUS)[number] }
  | { tipo: "ADICIONAR_ETIQUETA"; etiqueta: string }
  | { tipo: "NOTIFICAR_RESPONSAVEL"; texto?: string }
  | { tipo: "ATRIBUIR_RODIZIO" };

interface GatilhoConfig {
  palavras?: string[];
  horario?: { inicio: string; fim: string; dias: number[] };
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function foraDoHorario(cfg?: GatilhoConfig["horario"]): boolean {
  const inicio = cfg?.inicio ?? "08:00";
  const fim = cfg?.fim ?? "18:00";
  const dias = cfg?.dias ?? [1, 2, 3, 4, 5]; // seg–sex
  // Horário de Brasília (o servidor roda em UTC).
  const agora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = agora.getDay(); // 0=dom … 6=sáb
  if (!dias.includes(dia)) return true;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
  return minutosAgora < hi * 60 + mi || minutosAgora >= hf * 60 + mf;
}

function interpolar(texto: string, conversa: WhatsAppConversa, clienteNome?: string | null): string {
  const nome = conversa.contatoNome ?? clienteNome ?? "";
  const primeiro = nome.split(" ")[0] ?? "";
  return texto
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, primeiro)
    .replace(/\{\{\s*nome\s*\}\}/gi, nome);
}

async function proximoAtendente(sessaoId: string): Promise<string | null> {
  const usuarios = await prisma.user.findMany({
    where: { ativo: true, deletedAt: null },
    select: { id: true, role: true },
  });
  const elegiveis = usuarios.filter((u) => hasPermission(u.role, "whatsapp:use"));
  if (elegiveis.length === 0) return null;

  // Rodízio por carga: quem tem menos conversas abertas nessa sessão.
  const cargas = await prisma.whatsAppConversa.groupBy({
    by: ["responsavelId"],
    where: { sessaoId, status: "ABERTA", responsavelId: { in: elegiveis.map((u) => u.id) } },
    _count: { _all: true },
  });
  const carga = new Map(cargas.map((c) => [c.responsavelId as string, c._count._all]));
  elegiveis.sort((a, b) => (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0));
  return elegiveis[0].id;
}

async function executarAcao(acao: AcaoAutomacao, conversa: ConversaComSessao): Promise<void> {
  switch (acao.tipo) {
    case "ENVIAR_MENSAGEM": {
      let clienteNome: string | null = null;
      if (conversa.clienteId) {
        const c = await prisma.cliente.findUnique({ where: { id: conversa.clienteId }, select: { nome: true } });
        clienteNome = c?.nome ?? null;
      }
      await sendWhatsAppMessage(conversa, interpolar(acao.texto, conversa, clienteNome));
      break;
    }
    case "MOVER_ETAPA": {
      const existe = await prisma.whatsAppEtapa.findUnique({ where: { id: acao.etapa }, select: { id: true } });
      if (!existe) return;
      await prisma.whatsAppConversa.update({ where: { id: conversa.id }, data: { etapa: acao.etapa } });
      break;
    }
    case "DEFINIR_STATUS": {
      if (!STATUS.includes(acao.status)) return;
      await prisma.whatsAppConversa.update({ where: { id: conversa.id }, data: { status: acao.status } });
      break;
    }
    case "ADICIONAR_ETIQUETA": {
      const et = acao.etiqueta.trim();
      if (!et || conversa.tags.includes(et)) return;
      await prisma.whatsAppConversa.update({
        where: { id: conversa.id },
        data: { tags: { set: [...conversa.tags, et].slice(0, 12) } },
      });
      break;
    }
    case "ATRIBUIR_RODIZIO": {
      if (conversa.responsavelId) return; // já tem dono
      const alvo = await proximoAtendente(conversa.sessaoId);
      if (alvo) await prisma.whatsAppConversa.update({ where: { id: conversa.id }, data: { responsavelId: alvo } });
      break;
    }
    case "NOTIFICAR_RESPONSAVEL": {
      const alvo = conversa.responsavelId ?? conversa.sessao.atendenteId;
      if (!alvo) return;
      await prisma.notificacao.create({
        data: {
          userId: alvo,
          titulo: "Automação do WhatsApp",
          mensagem: acao.texto?.trim() || `Regra disparou na conversa com ${conversa.contatoNome ?? conversa.contatoPhone}`,
          tipo: "WHATSAPP_MENSAGEM",
          linkUrl: `/whatsapp?phone=${conversa.contatoPhone}`,
        },
      });
      break;
    }
  }
}

// Gatilho CLIENTE_CADASTRADO: um Cliente foi criado no CRM com WhatsApp.
// Abre (ou reaproveita) a conversa naquele número e roda as ações. Só manda
// mensagem se a conversa ainda não tem nenhuma — pra não "dar boas-vindas"
// em cima de um papo que já existe.
export async function executarAutomacoesClienteCadastrado(cliente: {
  id: string;
  nome: string;
  whatsapp?: string | null;
}): Promise<void> {
  const numero = paraJidNumero(cliente.whatsapp);
  if (!numero) return;

  const regras = await prisma.whatsAppAutomacao.findMany({
    where: { ativa: true, gatilho: "CLIENTE_CADASTRADO" },
  });
  if (regras.length === 0) return;

  const online = await prisma.whatsAppSessao.findMany({
    where: { ativo: true, status: "ONLINE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (online.length === 0) {
    waLogger.error("automação CLIENTE_CADASTRADO: nenhuma sessão online", {});
    return;
  }
  const onlineIds = new Set(online.map((s) => s.id));

  for (const regra of regras) {
    const acoes = (Array.isArray(regra.acoes) ? regra.acoes : []) as AcaoAutomacao[];
    if (acoes.length === 0) continue;

    // Canal fixo na regra: respeita à risca — se estiver offline, NÃO manda
    // por outro número (seria confuso pro cliente). Sem canal fixo: usa o
    // primeiro que estiver online.
    let sessaoId: string;
    if (regra.sessaoId) {
      if (!onlineIds.has(regra.sessaoId)) {
        waLogger.error(`automação CLIENTE_CADASTRADO ${regra.id}: canal escolhido está offline`, {});
        continue;
      }
      sessaoId = regra.sessaoId;
    } else {
      sessaoId = online[0].id;
    }

    try {
      const conversa = await prisma.whatsAppConversa.upsert({
        where: { sessaoId_contatoPhone: { sessaoId, contatoPhone: numero } },
        create: { sessaoId, contatoPhone: numero, contatoNome: cliente.nome, clienteId: cliente.id },
        update: { clienteId: cliente.id, contatoNome: cliente.nome },
        include: { sessao: true },
      });

      const jaTemMensagem = await prisma.whatsAppMensagem.count({ where: { conversaId: conversa.id } });
      if (jaTemMensagem > 0) continue; // conversa já existente: não manda boas-vindas

      for (const acao of acoes) {
        await executarAcao(acao, conversa);
      }
      await prisma.whatsAppAutomacao.update({
        where: { id: regra.id },
        data: { disparos: { increment: 1 }, ultimoDisparoEm: new Date() },
      });
      await emit("ConversationUpdated", { conversaId: conversa.id }, conversa.id);
    } catch (err) {
      waLogger.error(`falha na automação CLIENTE_CADASTRADO ${regra.id}`, { erro: err });
    }
  }
}

export async function executarAutomacoes(
  conversa: ConversaComSessao,
  ctx: { primeiraMensagem: boolean; conteudo: string; ultimaSaidaEm: Date | null },
): Promise<void> {
  if (conversa.isGrupo) return;

  const regras = await prisma.whatsAppAutomacao.findMany({
    where: { ativa: true, OR: [{ sessaoId: null }, { sessaoId: conversa.sessaoId }] },
  });
  if (regras.length === 0) return;

  const conteudoNorm = semAcento(ctx.conteudo);
  const respondeuRecente =
    ctx.ultimaSaidaEm != null && Date.now() - ctx.ultimaSaidaEm.getTime() < 30 * 60 * 1000;

  for (const regra of regras) {
    const cfg = (regra.gatilhoConfig ?? {}) as GatilhoConfig;
    const acoes = (Array.isArray(regra.acoes) ? regra.acoes : []) as AcaoAutomacao[];
    if (acoes.length === 0) continue;

    let bate = false;
    if (regra.gatilho === "CONTATO_NOVO") {
      bate = ctx.primeiraMensagem;
    } else if (regra.gatilho === "MENSAGEM_RECEBIDA") {
      bate = !cfg.palavras?.length || cfg.palavras.some((p) => conteudoNorm.includes(semAcento(p)));
    } else if (regra.gatilho === "FORA_DO_HORARIO") {
      bate = foraDoHorario(cfg.horario);
    }
    if (!bate) continue;

    // Anti-spam: se a regra manda mensagem e já respondemos nos últimos 30 min,
    // pula (evita responder a cada mensagem de uma rajada).
    const mandaMensagem = acoes.some((a) => a.tipo === "ENVIAR_MENSAGEM");
    if (mandaMensagem && respondeuRecente && regra.gatilho !== "CONTATO_NOVO") continue;

    try {
      for (const acao of acoes) {
        await executarAcao(acao, conversa);
      }
      await prisma.whatsAppAutomacao.update({
        where: { id: regra.id },
        data: { disparos: { increment: 1 }, ultimoDisparoEm: new Date() },
      });
      await emit("ConversationUpdated", { conversaId: conversa.id }, conversa.id);
    } catch (err) {
      waLogger.error(`falha ao executar automação ${regra.id}`, { erro: err, conversationId: conversa.id });
    }
  }
}

// ── Validação da config vinda da API ───────────────────────────────────────

const TIPOS_ACAO = [
  "ENVIAR_MENSAGEM", "MOVER_ETAPA", "DEFINIR_STATUS",
  "ADICIONAR_ETIQUETA", "NOTIFICAR_RESPONSAVEL", "ATRIBUIR_RODIZIO",
] as const;

export function sanearAcoes(raw: unknown): Prisma.InputJsonValue | null {
  if (!Array.isArray(raw)) return null;
  const out: Record<string, unknown>[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const tipo = (a as { tipo?: string }).tipo;
    if (!tipo || !TIPOS_ACAO.includes(tipo as (typeof TIPOS_ACAO)[number])) continue;
    if (tipo === "ENVIAR_MENSAGEM") {
      const texto = String((a as { texto?: unknown }).texto ?? "").trim();
      if (!texto) continue;
      out.push({ tipo, texto: texto.slice(0, 1000) });
    } else if (tipo === "MOVER_ETAPA") {
      const etapa = String((a as { etapa?: unknown }).etapa ?? "").trim();
      if (!etapa) continue; // a existência do id é checada na hora de executar
      out.push({ tipo, etapa });
    } else if (tipo === "DEFINIR_STATUS") {
      const status = String((a as { status?: unknown }).status ?? "");
      if (!STATUS.includes(status as (typeof STATUS)[number])) continue;
      out.push({ tipo, status });
    } else if (tipo === "ADICIONAR_ETIQUETA") {
      const etiqueta = String((a as { etiqueta?: unknown }).etiqueta ?? "").trim();
      if (!etiqueta) continue;
      out.push({ tipo, etiqueta: etiqueta.slice(0, 40) });
    } else if (tipo === "NOTIFICAR_RESPONSAVEL") {
      const texto = String((a as { texto?: unknown }).texto ?? "").trim().slice(0, 300);
      out.push(texto ? { tipo, texto } : { tipo });
    } else {
      out.push({ tipo });
    }
  }
  return out as Prisma.InputJsonValue;
}

export function sanearGatilhoConfig(raw: unknown): Prisma.InputJsonValue | null {
  if (!raw || typeof raw !== "object") return null;
  const cfg = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (Array.isArray(cfg.palavras)) {
    out.palavras = cfg.palavras
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  if (cfg.horario && typeof cfg.horario === "object") {
    const h = cfg.horario as Record<string, unknown>;
    const hm = (v: unknown) => (typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v) ? v : null);
    const dias = Array.isArray(h.dias)
      ? h.dias.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
      : [1, 2, 3, 4, 5];
    out.horario = { inicio: hm(h.inicio) ?? "08:00", fim: hm(h.fim) ?? "18:00", dias };
  }
  return Object.keys(out).length ? (out as Prisma.InputJsonValue) : null;
}
