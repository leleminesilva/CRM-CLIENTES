import type Anthropic from "@anthropic-ai/sdk";
import { SERVICOS } from "@/lib/constants";
import { SYSTEM_PROMPT } from "./system";

export const EXTRAIR_LEAD_TOOL: Anthropic.Tool = {
  name: "extrair_lead",
  description:
    "Registra o que foi entendido da mensagem do cliente e a resposta a enviar de volta pelo WhatsApp.",
  input_schema: {
    type: "object",
    properties: {
      intencao: {
        type: "string",
        enum: ["saudacao", "interesse_servico", "pedido_humano", "outro"],
        description:
          "'saudacao' se a mensagem for só um cumprimento vago sem mencionar serviço; 'interesse_servico' se demonstrar interesse em orçamento/serviço da vidraçaria; 'pedido_humano' se a pessoa pedir explicitamente para falar com um atendente/humano; 'outro' caso contrário.",
      },
      nome: {
        type: ["string", "null"],
        description: "Nome da pessoa, se ela mencionou em alguma mensagem da conversa.",
      },
      servico: {
        type: ["string", "null"],
        description: `O serviço desejado, escolhido exatamente entre uma destas opções: ${SERVICOS.join(", ")}. Use null se não ficou claro ou não corresponde a nenhuma dessas opções.`,
      },
      cidade: {
        type: ["string", "null"],
        description: "Cidade da pessoa, apenas se ela mencionou espontaneamente.",
      },
      urgente: {
        type: "boolean",
        description:
          'true se a mensagem usar linguagem de urgência ("quebrou", "urgente", "preciso hoje", etc).',
      },
      resumo: {
        type: ["string", "null"],
        description:
          "Uma frase curta com detalhes extras úteis que a pessoa mencionou (ex: 'cliente quer vidro fumê'). Null se não houver nada relevante além de nome/serviço.",
      },
      pronto_para_confirmar: {
        type: "boolean",
        description: "true somente quando nome E servico estiverem ambos preenchidos com confiança.",
      },
      resposta: {
        type: "string",
        description:
          "Mensagem curta e natural para enviar de volta ao cliente pelo WhatsApp, em português. Se pronto_para_confirmar for true, a resposta deve ser a pergunta de confirmação (repetindo nome e serviço entendidos e perguntando se está correto).",
      },
    },
    required: ["intencao", "urgente", "pronto_para_confirmar", "resposta"],
  },
};

/**
 * System prompt for the TRIAGEM/COLETANDO stages: base persona plus whatever
 * we've already extracted, so the model doesn't ask twice for the same info.
 */
export function buildColetaSystemPrompt(conhecido: {
  nome?: string | null;
  servico?: string | null;
  cidade?: string | null;
}): string {
  const sabido = [
    conhecido.nome ? `nome=${conhecido.nome}` : null,
    conhecido.servico ? `serviço=${conhecido.servico}` : null,
    conhecido.cidade ? `cidade=${conhecido.cidade}` : null,
  ].filter(Boolean);

  if (sabido.length === 0) return SYSTEM_PROMPT;

  return `${SYSTEM_PROMPT}\n\nJá sabemos sobre este cliente: ${sabido.join(", ")}. Não pergunte de novo o que já sabemos — só confirme quando tiver nome e serviço.`;
}
