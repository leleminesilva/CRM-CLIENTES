import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { formatBrazilianPhone } from "@/lib/utils/phone";

// Copiloto de resposta: a IA lê a conversa e o registro do CRM e devolve UM
// rascunho de mensagem. O atendente revisa e envia — nada é mandado pelo bot
// aqui. Ver docs/architecture/whatsapp-crm-integracao.md (Parte 2.1).

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `Você é atendente da Infinity Glass, uma vidraçaria em Santa Catarina
(box, portas e janelas de vidro, espelhos, guarda-corpo, fachadas).

Escreva UMA resposta para mandar ao cliente pelo WhatsApp:
- tom natural, cordial e direto, em pt-BR, como uma pessoa da equipe escreveria
- curta (1 a 3 frases), sem saudação formal repetida se a conversa já começou
- NUNCA invente preço, medida, prazo ou disponibilidade. Se o cliente pede um
  valor e não há essa informação na conversa, diga que vai confirmar com a
  equipe e retornar em seguida
- se faltam dados para orçar (medidas largura x altura, tipo/espessura de vidro,
  cidade), peça o que falta de forma objetiva
- não assine com nome
- responda SOMENTE com o texto da mensagem, sem aspas e sem comentários`;

export async function sugerirResposta(conversaId: string): Promise<string> {
  const conversa = await prisma.whatsAppConversa.findUniqueOrThrow({
    where: { id: conversaId },
    include: {
      mensagens: { orderBy: { enviadaEm: "asc" }, take: 25 },
    },
  });

  let contexto = `Contato: ${conversa.contatoNome ?? formatBrazilianPhone(conversa.contatoPhone)}.`;
  if (conversa.clienteId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: conversa.clienteId },
      select: { nome: true, cidade: true, servicoBuscado: true },
    });
    if (cliente) {
      contexto += ` Já é cliente no CRM: ${cliente.nome}`;
      if (cliente.cidade) contexto += `, ${cliente.cidade}`;
      if (cliente.servicoBuscado) contexto += `. Serviço de interesse: ${cliente.servicoBuscado}`;
      contexto += ".";
    }
  } else {
    contexto += " Ainda não está cadastrado no CRM.";
  }

  const historico = conversa.mensagens
    .map((m) => `${m.direcao === "saida" ? "Atendente" : "Cliente"}: ${m.conteudo || "[mídia]"}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${contexto}\n\nConversa até agora:\n${historico}\n\nEscreva a próxima resposta do atendente.`,
      },
    ],
  });

  const bloco = response.content.find((b) => b.type === "text");
  const texto = bloco && bloco.type === "text" ? bloco.text.trim() : "";
  if (!texto) throw new Error("A IA não retornou sugestão");
  return texto;
}
