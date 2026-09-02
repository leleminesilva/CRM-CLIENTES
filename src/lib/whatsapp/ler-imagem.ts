import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

// Leitura de foto pela IA: o cliente manda uma foto do local (vão, parede,
// box atual) e a IA descreve o que é relevante pra orçar. Não inventa medida.
// Roda sob demanda quando o atendente clica em "Ler pela IA". Ver
// docs/architecture/whatsapp-crm-integracao.md (Parte 2).

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";
const BUCKET = "whatsapp-media";

const MIME_POR_EXT: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

const SYSTEM = `Você é atendente da Infinity Glass, uma vidraçaria em Santa Catarina
(box, portas e janelas de vidro, espelhos, guarda-corpo, fachadas).

O cliente enviou uma foto do local. Descreva de forma objetiva só o que ajuda a
orçar: tipo de instalação (box de canto, box reto, porta, janela, espelho,
guarda-corpo…), tipo de parede/acabamento, se há ponto de água ou energia
aparente, obstáculos, e o estado do local (obra crua, revestimento pronto).

Regras:
- 2 a 4 frases, pt-BR, tom de quem vai orçar
- NÃO invente medidas nem valores; se dá pra estimar uma proporção pela foto,
  deixe claro que é aproximado
- se a foto não ajuda a orçar (borrada, sem contexto), diga isso`;

export async function lerImagem(conversaId: string, mensagemId: string): Promise<string> {
  const msg = await prisma.whatsAppMensagem.findFirstOrThrow({
    where: { id: mensagemId, conversaId },
  });
  if (msg.tipo !== "imagem" || !msg.mediaUrl) {
    throw new Error("Mensagem não é uma imagem");
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(msg.mediaUrl);
  if (error || !data) throw new Error(error?.message ?? "Falha ao baixar a imagem");

  const buffer = Buffer.from(await data.arrayBuffer());
  const ext = msg.mediaUrl.split(".").pop()?.toLowerCase() ?? "jpg";
  const mediaType = MIME_POR_EXT[ext] ?? "image/jpeg";

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: buffer.toString("base64") } },
          { type: "text", text: `Legenda enviada com a foto: "${msg.conteudo || "(sem legenda)"}". O que dá pra ver pra orçar?` },
        ],
      },
    ],
  });

  const bloco = response.content.find((b) => b.type === "text");
  const texto = bloco && bloco.type === "text" ? bloco.text.trim() : "";
  if (!texto) throw new Error("A IA não retornou leitura");
  return texto;
}
