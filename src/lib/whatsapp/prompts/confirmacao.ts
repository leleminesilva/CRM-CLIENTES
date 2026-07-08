import type Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./system";

export const INTERPRETAR_CONFIRMACAO_TOOL: Anthropic.Tool = {
  name: "interpretar_confirmacao",
  description:
    "Interpreta a resposta do cliente a uma pergunta de confirmação de nome + serviço.",
  input_schema: {
    type: "object",
    properties: {
      resultado: {
        type: "string",
        enum: ["confirmado", "corrigir", "pedido_humano", "nao_entendi"],
        description:
          "'confirmado' se o cliente confirmou os dados; 'corrigir' se ele negou ou corrigiu algo (nome ou serviço errado); 'pedido_humano' se ele pedir para falar com um atendente; 'nao_entendi' se a resposta não for um sim/não claro.",
      },
      nome_corrigido: {
        type: ["string", "null"],
        description: "Novo nome, se o cliente corrigiu o nome. Null se não mudou.",
      },
      servico_corrigido: {
        type: ["string", "null"],
        description: "Novo serviço, se o cliente corrigiu o serviço. Null se não mudou.",
      },
      resposta: {
        type: "string",
        description:
          "Mensagem curta para responder ao cliente: se confirmado, um agradecimento avisando que a equipe vai continuar o atendimento; se corrigir, repita a pergunta com os dados corrigidos; se não entendi, peça para responder só 'sim' ou 'não'.",
      },
    },
    required: ["resultado", "resposta"],
  },
};

export function buildConfirmacaoSystemPrompt(nome: string, servico: string): string {
  return `${SYSTEM_PROMPT}\n\nVocê acabou de perguntar ao cliente se os dados estão corretos: nome="${nome}", serviço="${servico}". Interprete a resposta dele.`;
}
