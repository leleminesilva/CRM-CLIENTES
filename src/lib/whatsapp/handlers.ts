import prisma from "@/lib/prisma";
import { on, emit } from "./events";
import { publicarConversa } from "./realtime";
import { findClienteByPhone } from "@/lib/utils/phone";
import { processarAgenteWhatsApp } from "./agent";
import { waLogger } from "./logger";

// Handlers do pipeline de eventos — substituem a lógica que antes ficava
// inline no webhook. Cada handler é independente e pode ser adicionado sem
// tocar em quem emite o evento. Ver docs/architecture/whatsapp.md.

export interface MessageReceivedPayload {
  conversaId: string;
  sessaoId: string;
  fromPhone: string;
}

export interface ConversationUpdatedPayload {
  conversaId: string;
}

let registrado = false;

// Idempotente — múltiplas chamadas (ex: hot reload em dev) não duplicam handlers.
export function registrarHandlersWhatsApp(): void {
  if (registrado) return;
  registrado = true;

  // Dispara o agente de triagem pra número desconhecido — mesmo comportamento
  // de antes, só que agora como um handler de MessageReceived em vez de
  // lógica inline no webhook. Ver "agent.ts vira só mais um handler".
  on<MessageReceivedPayload>("MessageReceived", async (event) => {
    const { conversaId, fromPhone } = event.payload;
    const conversa = await prisma.whatsAppConversa.findUnique({
      where: { id: conversaId },
      include: { sessao: true },
    });
    if (!conversa) return;

    // Costura com o CRM: se a conversa ainda não aponta pra ninguém e existe
    // um Cliente com esse telefone, vincula automaticamente — a partir daí a
    // ficha do cliente aparece no painel da conversa. Ver
    // docs/architecture/whatsapp-crm-integracao.md.
    if (!conversa.clienteId) {
      const clienteExistente = await findClienteByPhone(fromPhone);
      if (clienteExistente) {
        await prisma.whatsAppConversa.update({
          where: { id: conversaId },
          data: { clienteId: clienteExistente.id },
        });
        await emit("ConversationUpdated", { conversaId }, conversaId);
        return; // cliente conhecido: não dispara o bot de triagem
      }
    } else {
      return; // já vinculado: bot não roda
    }

    // Número desconhecido → agente de triagem
    const agentEstado = await prisma.whatsAppAgentEstado.findUnique({ where: { conversaId } });
    if (agentEstado?.estado === "HUMANO" || agentEstado?.estado === "CONCLUIDO") return;

    await processarAgenteWhatsApp(conversa);
  });

  // Notifica o atendente da sessão sobre a nova mensagem — sem duplicar se já
  // existir uma notificação não lida recente pra essa mesma conversa.
  on<MessageReceivedPayload>("MessageReceived", async (event) => {
    const { sessaoId, fromPhone } = event.payload;
    const sessao = await prisma.whatsAppSessao.findUnique({ where: { id: sessaoId } });
    if (!sessao?.atendenteId) return;

    const linkUrl = `/whatsapp?phone=${fromPhone}`;
    const jaNotificado = await prisma.notificacao.findFirst({
      where: {
        userId: sessao.atendenteId,
        tipo: "WHATSAPP_MENSAGEM",
        linkUrl,
        lida: false,
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });
    if (jaNotificado) return;

    await prisma.notificacao.create({
      data: {
        userId: sessao.atendenteId,
        titulo: "Nova mensagem no WhatsApp",
        mensagem: `Nova mensagem recebida em "${sessao.nome}"`,
        tipo: "WHATSAPP_MENSAGEM",
        linkUrl,
      },
    });
  });

  // Propaga a mudança via Realtime — frontend invalida a query REST em vez de
  // fazer polling.
  on<ConversationUpdatedPayload>("ConversationUpdated", async (event) => {
    try {
      await publicarConversa(event.payload.conversaId);
    } catch (err) {
      waLogger.error("falha ao publicar conversa no Realtime", { erro: err, conversationId: event.payload.conversaId });
    }
  });
}
