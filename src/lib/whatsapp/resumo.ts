import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { formatBrazilianPhone } from "@/lib/utils/phone";

// Resumo da IA da conversa: lê o histórico + o registro do CRM e devolve um
// resumo estruturado em tópicos curtos, pra o atendente se situar sem reler
// tudo. É gerado sob demanda (não persiste) — o painel chama quando o usuário
// clica em "Gerar resumo". Ver docs/architecture/whatsapp-crm-integracao.md.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `Você resume conversas de atendimento da Infinity Glass, uma vidraçaria
em Santa Catarina (box, portas e janelas de vidro, espelhos, guarda-corpo, fachadas).

Leia a conversa e devolva um resumo curto pra o atendente se situar rápido.
Responda SOMENTE com um JSON no formato:
{"itens":[{"rotulo":"Quer","texto":"..."},{"rotulo":"Medidas","texto":"..."},{"rotulo":"Produto","texto":"..."},{"rotulo":"Orçamento","texto":"..."},{"rotulo":"Próximo passo","texto":"..."}]}

Regras:
- cada "texto" com no máximo ~90 caracteres, objetivo, em pt-BR
- use só o que está na conversa; se algo não foi dito, escreva "—"
- NÃO invente preço, medida ou prazo
- não inclua nenhum texto fora do JSON`;

export interface ResumoItem {
  rotulo: string;
  texto: string;
}
export interface ResumoConversa {
  itens: ResumoItem[];
  baseadoEm: string;
}

export async function resumirConversa(conversaId: string): Promise<ResumoConversa> {
  const conversa = await prisma.whatsAppConversa.findUniqueOrThrow({
    where: { id: conversaId },
    include: {
      mensagens: { orderBy: { enviadaEm: "asc" }, take: 40 },
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
  }

  const audios = conversa.mensagens.filter((m) => m.tipo === "audio").length;
  const fotos = conversa.mensagens.filter((m) => m.tipo === "imagem" || m.tipo === "image").length;

  const historico = conversa.mensagens
    .map((m) => `${m.direcao === "saida" ? "Atendente" : "Cliente"}: ${m.conteudo || `[${m.tipo}]`}`)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `${contexto}\n\nConversa até agora:\n${historico}\n\nResuma.`,
      },
    ],
  });

  const bloco = response.content.find((b) => b.type === "text");
  const raw = bloco && bloco.type === "text" ? bloco.text.trim() : "";
  let itens: ResumoItem[] = [];
  try {
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { itens?: ResumoItem[] };
    itens = (parsed.itens ?? [])
      .filter((i) => i && typeof i.rotulo === "string" && typeof i.texto === "string")
      .slice(0, 6);
  } catch {
    // fallback: uma linha só com o texto cru
    itens = [{ rotulo: "Resumo", texto: raw.slice(0, 240) }];
  }
  if (itens.length === 0) throw new Error("A IA não retornou resumo");

  const total = conversa.mensagens.length;
  const partes = [`${total} mensage${total === 1 ? "m" : "ns"}`];
  if (audios) partes.push(`${audios} áudio${audios > 1 ? "s" : ""}`);
  if (fotos) partes.push(`${fotos} foto${fotos > 1 ? "s" : ""}`);

  return { itens, baseadoEm: partes.join(" · ") };
}
