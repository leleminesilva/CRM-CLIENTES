import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { clienteSchema } from "@/lib/validators/cliente";
import { createAuditLog } from "@/lib/audit";
import { formatBrazilianPhone } from "@/lib/utils/phone";
import { sendWhatsAppMessage } from "./send";
import { EXTRAIR_LEAD_TOOL, buildColetaSystemPrompt } from "./prompts/coleta";
import { INTERPRETAR_CONFIRMACAO_TOOL, buildConfirmacaoSystemPrompt } from "./prompts/confirmacao";
import type { WhatsAppConversa, WhatsAppSessao, WhatsAppMensagem, HandoffReason } from "@prisma/client";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TENTATIVAS = 4;
const AGENT_VERSION = "1.0";
const SYSTEM_BOT_EMAIL = "whatsapp-bot@infinityglass.internal";
const MSG_HANDOFF = "Vou chamar alguém da nossa equipe para continuar seu atendimento por aqui, só um momento! 🙂";

type ConversaComSessao = WhatsAppConversa & { sessao: WhatsAppSessao };

function logAgentEvent(evento: string, dados: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ agente: "whatsapp-recepcao", evento, ...dados, ts: new Date().toISOString() }));
}

function isHorarioComercial(d: Date): boolean {
  const dia = d.getDay(); // 0 = domingo
  const hora = d.getHours();
  if (dia === 0) return false;
  if (dia === 6) return hora >= 8 && hora < 12;
  return hora >= 8 && hora < 18;
}

async function getOrCreateSystemUser() {
  const existente = await prisma.user.findUnique({ where: { email: SYSTEM_BOT_EMAIL } });
  if (existente) return existente;
  return prisma.user.create({
    data: {
      nome: "WhatsApp Bot",
      email: SYSTEM_BOT_EMAIL,
      senha: randomUUID(), // nunca usado para login — ativo:false já bloqueia
      role: "OPERACIONAL",
      ativo: false,
    },
  });
}

/** Colapsa mensagens consecutivas do mesmo papel — a API exige alternância. */
function toAnthropicMessages(mensagens: WhatsAppMensagem[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const m of mensagens) {
    const role = m.direcao === "entrada" ? "user" : "assistant";
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content = `${last.content}\n${m.conteudo}`;
    } else {
      out.push({ role, content: m.conteudo || "[mensagem sem texto]" });
    }
  }
  // A API exige que a conversa comece com "user"
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

async function extrairLead(
  mensagens: WhatsAppMensagem[],
  conhecido: { nome?: string | null; servico?: string | null; cidade?: string | null }
) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildColetaSystemPrompt(conhecido),
    messages: toAnthropicMessages(mensagens),
    tools: [EXTRAIR_LEAD_TOOL],
    tool_choice: { type: "tool", name: "extrair_lead" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Claude não retornou extrair_lead");

  return toolUse.input as {
    intencao: "saudacao" | "interesse_servico" | "pedido_humano" | "outro";
    nome: string | null;
    servico: string | null;
    cidade: string | null;
    urgente: boolean;
    resumo: string | null;
    pronto_para_confirmar: boolean;
    resposta: string;
  };
}

async function interpretarConfirmacao(mensagens: WhatsAppMensagem[], nome: string, servico: string) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildConfirmacaoSystemPrompt(nome, servico),
    messages: toAnthropicMessages(mensagens),
    tools: [INTERPRETAR_CONFIRMACAO_TOOL],
    tool_choice: { type: "tool", name: "interpretar_confirmacao" },
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("Claude não retornou interpretar_confirmacao");

  return toolUse.input as {
    resultado: "confirmado" | "corrigir" | "pedido_humano" | "nao_entendi";
    nome_corrigido: string | null;
    servico_corrigido: string | null;
    resposta: string;
  };
}

async function criarClienteDoBot(
  conversa: WhatsAppConversa,
  dados: { nome: string; servico: string; cidade: string | null; urgente: boolean; resumo: string | null }
) {
  const sistemUser = await getOrCreateSystemUser();

  const payload = clienteSchema.parse({
    nome: dados.nome,
    whatsapp: formatBrazilianPhone(conversa.contatoPhone),
    servicoBuscado: dados.servico,
    cidade: dados.cidade ?? undefined,
    observacoes: dados.resumo ?? undefined,
    origem: "WHATSAPP",
    temperatura: dados.urgente ? "QUENTE" : "MORNO",
    statusOrcamento: "PENDENTE",
  });

  const cliente = await prisma.cliente.create({
    data: { ...payload, responsavelId: null },
  });

  await prisma.lead.create({
    data: {
      titulo: `${cliente.nome} — ${dados.servico}`,
      estagio: "NOVO_LEAD",
      temperatura: dados.urgente ? "QUENTE" : "MORNO",
      origem: "WHATSAPP",
      clienteId: cliente.id,
      ordemKanban: 0,
    },
  });

  const detalhes = [
    `Nome: ${dados.nome}`,
    `Serviço: ${dados.servico}`,
    dados.cidade ? `Cidade: ${dados.cidade}` : null,
    dados.resumo ? `Observação: ${dados.resumo}` : null,
    `Telefone: ${payload.whatsapp}`,
    "Cliente cadastrado automaticamente pelo agente de IA do WhatsApp, com confirmação do cliente.",
  ].filter(Boolean).join("\n");

  await createAuditLog({
    userId: sistemUser.id,
    entidade: "Cliente",
    entidadeId: cliente.id,
    acao: "CREATE",
    dadosNovos: payload,
  });
  await prisma.atividade.create({
    data: { tipo: "CRIACAO", descricao: detalhes, userId: sistemUser.id, clienteId: cliente.id },
  });

  return cliente;
}

async function transferirParaHumano(conversa: ConversaComSessao, motivo: HandoffReason, tentativas: number) {
  await prisma.whatsAppAgentEstado.update({
    where: { conversaId: conversa.id },
    data: { estado: "HUMANO", motivoTransferencia: motivo, tentativas },
  });
  logAgentEvent("HANDOFF_TO_HUMAN", { conversaId: conversa.id, motivo });
  await sendWhatsAppMessage(conversa, MSG_HANDOFF);
}

export async function processarAgenteWhatsApp(conversa: ConversaComSessao) {
  try {
    let estadoAtual = await prisma.whatsAppAgentEstado.upsert({
      where: { conversaId: conversa.id },
      create: { conversaId: conversa.id },
      update: {},
    });

    if (estadoAtual.estado === "CONCLUIDO" || estadoAtual.estado === "HUMANO") return;

    logAgentEvent("AGENT_STARTED", { conversaId: conversa.id, estado: estadoAtual.estado });

    const mensagens = await prisma.whatsAppMensagem.findMany({
      where: { conversaId: conversa.id },
      orderBy: { enviadaEm: "asc" },
      take: 20,
    });

    const primeiraMensagemDoBot = !(await prisma.whatsAppMensagem.findFirst({
      where: { conversaId: conversa.id, direcao: "saida" },
    }));
    const prefixoForaDoHorario =
      primeiraMensagemDoBot && !isHorarioComercial(new Date())
        ? "Recebemos sua mensagem! Estamos fora do horário de atendimento, mas vou adiantar algumas informações. "
        : "";

    if (estadoAtual.estado === "TRIAGEM" || estadoAtual.estado === "COLETANDO") {
      const extraido = await extrairLead(mensagens, estadoAtual);
      logAgentEvent("INTENT_DETECTED", { conversaId: conversa.id, intencao: extraido.intencao });

      if (extraido.intencao === "pedido_humano") {
        await transferirParaHumano(conversa, "CLIENTE_PEDIU_HUMANO", estadoAtual.tentativas + 1);
        return;
      }

      const nome = extraido.nome ?? estadoAtual.nome;
      const servico = extraido.servico ?? estadoAtual.servico;
      const cidade = extraido.cidade ?? estadoAtual.cidade;
      const urgente = extraido.urgente || estadoAtual.urgente;
      const resumo = extraido.resumo ?? estadoAtual.resumo;
      const tentativas = estadoAtual.tentativas + 1;

      let novoEstado: "TRIAGEM" | "COLETANDO" | "AGUARDANDO_CONFIRMACAO" = "COLETANDO";
      if (extraido.intencao === "saudacao" && estadoAtual.estado === "TRIAGEM") {
        novoEstado = "TRIAGEM";
      } else if (extraido.pronto_para_confirmar && nome && servico) {
        novoEstado = "AGUARDANDO_CONFIRMACAO";
        logAgentEvent("SERVICE_IDENTIFIED", { conversaId: conversa.id, nome, servico });
      }

      // Ainda não resolvido depois de muitas idas e vindas: passa pra humano
      // em vez de continuar insistindo. Se já sabemos o nome mas nunca
      // conseguimos casar o serviço com a lista, o motivo é mais específico.
      if (novoEstado !== "AGUARDANDO_CONFIRMACAO" && tentativas > MAX_TENTATIVAS) {
        await transferirParaHumano(
          conversa,
          nome && !servico ? "SERVICO_NAO_RECONHECIDO" : "MUITAS_TENTATIVAS",
          tentativas
        );
        return;
      }

      estadoAtual = await prisma.whatsAppAgentEstado.update({
        where: { conversaId: conversa.id },
        data: { estado: novoEstado, nome, servico, cidade, urgente, resumo, tentativas },
      });

      await sendWhatsAppMessage(conversa, `${prefixoForaDoHorario}${extraido.resposta}`);
      if (novoEstado === "AGUARDANDO_CONFIRMACAO") {
        logAgentEvent("CONFIRMATION_SENT", { conversaId: conversa.id });
      }
      return;
    }

    if (estadoAtual.estado === "AGUARDANDO_CONFIRMACAO") {
      if (!estadoAtual.nome || !estadoAtual.servico) return; // não deveria acontecer

      const interpretado = await interpretarConfirmacao(mensagens, estadoAtual.nome, estadoAtual.servico);

      if (interpretado.resultado === "pedido_humano") {
        await transferirParaHumano(conversa, "CLIENTE_PEDIU_HUMANO", estadoAtual.tentativas + 1);
        return;
      }

      if (interpretado.resultado === "confirmado") {
        const cliente = await criarClienteDoBot(conversa, {
          nome: estadoAtual.nome,
          servico: estadoAtual.servico,
          cidade: estadoAtual.cidade,
          urgente: estadoAtual.urgente,
          resumo: estadoAtual.resumo,
        });
        await prisma.whatsAppAgentEstado.update({
          where: { conversaId: conversa.id },
          data: { estado: "CONCLUIDO", clienteId: cliente.id, agentVersion: AGENT_VERSION },
        });
        logAgentEvent("CLIENT_CREATED", { conversaId: conversa.id, clienteId: cliente.id });
        await sendWhatsAppMessage(conversa, interpretado.resposta);
        return;
      }

      if (interpretado.resultado === "corrigir") {
        await prisma.whatsAppAgentEstado.update({
          where: { conversaId: conversa.id },
          data: {
            estado: "COLETANDO",
            nome: interpretado.nome_corrigido ?? estadoAtual.nome,
            servico: interpretado.servico_corrigido ?? estadoAtual.servico,
          },
        });
        await sendWhatsAppMessage(conversa, interpretado.resposta);
        return;
      }

      // nao_entendi
      const tentativas = estadoAtual.tentativas + 1;
      if (tentativas > MAX_TENTATIVAS) {
        await transferirParaHumano(conversa, "MUITAS_TENTATIVAS", tentativas);
        return;
      }
      await prisma.whatsAppAgentEstado.update({
        where: { conversaId: conversa.id },
        data: { tentativas },
      });
      await sendWhatsAppMessage(conversa, interpretado.resposta);
    }
  } catch (err) {
    logAgentEvent("ERROR", { conversaId: conversa.id, error: err instanceof Error ? err.message : String(err) });
  }
}
