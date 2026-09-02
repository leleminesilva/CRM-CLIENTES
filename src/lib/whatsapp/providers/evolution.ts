import { createHash } from "crypto";
import type {
  IWhatsAppProvider,
  ProviderCapabilities,
  MensagemPayload,
  NormalizedMedia,
  NormalizedWebhookEvent,
} from "./types";
import type { WhatsAppSessaoStatus } from "@prisma/client";

// Implementação concreta contra a Evolution API (https://github.com/EvolutionAPI/evolution-api).
// Único arquivo do sistema que conhece o formato de request/response dela — ver
// docs/architecture/whatsapp.md. Os paths/payloads abaixo seguem o contrato conhecido
// da Evolution API v2, mas ainda não foram verificados contra uma instância real rodando
// (isso acontece na Fase 5, quando a VPS existir) — ajustar aqui, e só aqui, se divergir.

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

type TipoMensagem = "texto" | "imagem" | "video" | "audio" | "documento";

// Mídia no WhatsApp é criptografada ponta a ponta — o campo "url" bruto do
// Baileys aponta pra um blob cifrado no CDN da Meta, sem uso direto. A
// Evolution API tem uma opção de configuração (webhook em modo base64) que
// entrega o conteúdo já decodificado no próprio payload; é o que assumimos
// aqui. Se o gateway não estiver configurado assim, a mensagem ainda é
// registrada (tipo + legenda), só sem o arquivo em si — precisa verificar
// contra a instância real na Fase 5.
function extrairConteudoMensagem(
  message: Record<string, unknown> | undefined,
  data: Record<string, unknown>
): { tipo: TipoMensagem; conteudo?: string; media?: NormalizedMedia } {
  if (!message) return { tipo: "texto", conteudo: "" };

  const texto = (message.conversation as string) ?? (message.extendedTextMessage as { text?: string })?.text;
  if (texto !== undefined) return { tipo: "texto", conteudo: texto };

  const tiposMidia: { chave: string; tipo: TipoMensagem }[] = [
    { chave: "imageMessage", tipo: "imagem" },
    { chave: "videoMessage", tipo: "video" },
    { chave: "audioMessage", tipo: "audio" },
    { chave: "documentMessage", tipo: "documento" },
  ];

  for (const { chave, tipo } of tiposMidia) {
    const submensagem = message[chave] as Record<string, unknown> | undefined;
    if (!submensagem) continue;

    const base64 = (submensagem.base64 as string) ?? (data.base64 as string) ?? undefined;
    return {
      tipo,
      conteudo: (submensagem.caption as string) ?? undefined,
      media: {
        base64,
        mimeType: (submensagem.mimetype as string) ?? "application/octet-stream",
        filename: (submensagem.fileName as string) ?? undefined,
      },
    };
  }

  return { tipo: "texto", conteudo: "" };
}

function baseUrl(): string {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL não configurada");
  return url.replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY não configurada");
  return key;
}

async function chamarComRetry(path: string, init: RequestInit): Promise<Response> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= MAX_RETRIES; tentativa++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl()}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { "Content-Type": "application/json", apikey: apiKey(), ...init.headers },
      });
      clearTimeout(timeoutId);
      if (res.ok) return res;
      if (res.status >= 400 && res.status < 500) return res; // erro do cliente não se resolve com retry
      ultimoErro = new Error(`Evolution API respondeu ${res.status}`);
    } catch (err) {
      clearTimeout(timeoutId);
      ultimoErro = err;
    }
    if (tentativa < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * tentativa));
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("Falha ao chamar Evolution API");
}

function estadoParaStatus(state: string | undefined): WhatsAppSessaoStatus {
  switch (state) {
    case "open":
      return "ONLINE";
    case "connecting":
      return "RECONNECTING";
    case "close":
      return "OFFLINE";
    default:
      return "UNKNOWN";
  }
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class EvolutionProvider implements IWhatsAppProvider {
  readonly capabilities: ProviderCapabilities = {
    supportsReadReceipt: true,
    supportsTyping: true,
    supportsMedia: true,
    supportsGroup: true,
    supportsReaction: true,
    supportsStatus: true,
  };

  async createSession(nome: string): Promise<{ providerSessionId: string; providerVersion?: string }> {
    const res = await chamarComRetry("/instance/create", {
      method: "POST",
      body: JSON.stringify({ instanceName: nome, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    });
    if (!res.ok) throw new Error(`Erro ao criar sessão na Evolution API: ${res.status}`);
    const data = await res.json();
    return {
      providerSessionId: data.instance?.instanceName ?? nome,
      providerVersion: data.instance?.version ?? undefined,
    };
  }

  async getQrCode(providerSessionId: string): Promise<{ qrCode: string | null; status: WhatsAppSessaoStatus }> {
    const res = await chamarComRetry(`/instance/connect/${providerSessionId}`, { method: "GET" });
    if (!res.ok) return { qrCode: null, status: "ERROR" };
    const data = await res.json();
    return {
      qrCode: data.base64 ?? data.qrcode?.base64 ?? null,
      status: estadoParaStatus(data.instance?.state ?? data.state),
    };
  }

  async getStatus(providerSessionId: string): Promise<WhatsAppSessaoStatus> {
    const res = await chamarComRetry(`/instance/connectionState/${providerSessionId}`, { method: "GET" });
    if (!res.ok) return "ERROR";
    const data = await res.json();
    return estadoParaStatus(data.instance?.state);
  }

  async disconnect(providerSessionId: string): Promise<void> {
    await chamarComRetry(`/instance/logout/${providerSessionId}`, { method: "DELETE" });
  }

  async restart(providerSessionId: string): Promise<void> {
    await chamarComRetry(`/instance/restart/${providerSessionId}`, { method: "PUT" });
  }

  async deleteSession(providerSessionId: string): Promise<void> {
    await chamarComRetry(`/instance/delete/${providerSessionId}`, { method: "DELETE" });
  }

  async sendMessage(
    providerSessionId: string,
    toPhone: string,
    payload: MensagemPayload
  ): Promise<{ providerMessageId: string }> {
    const path =
      payload.tipo === "texto" ? `/message/sendText/${providerSessionId}` : `/message/sendMedia/${providerSessionId}`;

    const body =
      payload.tipo === "texto"
        ? { number: toPhone, text: payload.conteudo }
        : {
            number: toPhone,
            mediatype: payload.tipo,
            media: payload.media.url ?? payload.media.base64,
            caption: payload.legenda,
            fileName: payload.media.filename,
          };

    const res = await chamarComRetry(path, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Erro ao enviar mensagem via Evolution API: ${res.status}`);
    const data = await res.json();
    const providerMessageId = data.key?.id ?? data.messageId;
    if (!providerMessageId) throw new Error("Evolution API não retornou id da mensagem enviada");
    return { providerMessageId };
  }

  parseWebhook(rawBody: unknown): NormalizedWebhookEvent[] {
    const body = rawBody as Record<string, unknown>;
    const event = body.event as string | undefined;
    const data = body.data as Record<string, unknown> | undefined;
    if (!event || !data) return [];

    const providerEventId = (data.id as string) ?? hashPayload(body);

    if (event === "messages.upsert") {
      const key = data.key as Record<string, unknown> | undefined;
      const message = data.message as Record<string, unknown> | undefined;
      const { tipo, conteudo, media } = extrairConteudoMensagem(message, data);

      const fromMe = !!key?.fromMe;
      const remoteJid = (key?.remoteJid as string) ?? "";
      const isGrupo = remoteJid.endsWith("@g.us");
      // Em grupo, remoteJid é o id do grupo e key.participant é quem enviou.
      // pushName, nesse caso, é o nome de quem enviou — não o do grupo.
      const participant = (key?.participant as string) ?? "";

      return [
        {
          schemaVersion: 1,
          providerEventId,
          type: "message",
          data: {
            providerMessageId: (key?.id as string) ?? providerEventId,
            fromPhone: remoteJid.replace(/@.*/, ""),
            tipo,
            conteudo,
            media,
            timestamp: new Date(Number(data.messageTimestamp ?? Date.now() / 1000) * 1000),
            contatoNome: isGrupo
              ? ((data.groupSubject as string | undefined) ?? undefined)
              : fromMe
                ? undefined
                : (data.pushName as string | undefined),
            isGrupo,
            fromMe,
            providerMessageKey: key,
            remetentePhone: isGrupo && !fromMe && participant ? participant.replace(/@.*/, "") : undefined,
            remetenteNome: isGrupo && !fromMe ? (data.pushName as string | undefined) : undefined,
          },
        },
      ];
    }

    if (event === "connection.update") {
      return [
        {
          schemaVersion: 1,
          providerEventId,
          type: "session",
          data: {
            providerSessionId: body.instance as string,
            status: estadoParaStatus(data.state as string | undefined),
          },
        },
      ];
    }

    if (event === "qrcode.updated") {
      const qrcode = data.qrcode as { base64?: string } | undefined;
      return [
        {
          schemaVersion: 1,
          providerEventId,
          type: "session",
          data: {
            providerSessionId: body.instance as string,
            status: "WAITING_QR",
            qrCode: qrcode?.base64,
          },
        },
      ];
    }

    return [];
  }

  // Rebusca a mídia no gateway quando o webhook chega sem base64 (Evolution
  // não manda o conteúdo por padrão). Ver docs/architecture/whatsapp.md.
  async baixarMedia(
    providerSessionId: string,
    messageKey: Record<string, unknown>
  ): Promise<{ base64: string; mimeType: string; filename?: string } | null> {
    try {
      const res = await chamarComRetry(`/chat/getBase64FromMediaMessage/${providerSessionId}`, {
        method: "POST",
        body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      const base64 = (data.base64 as string) ?? undefined;
      if (!base64) return null;
      return {
        base64,
        mimeType: (data.mimetype as string) ?? (data.mimeType as string) ?? "application/octet-stream",
        filename: (data.fileName as string) ?? (data.filename as string) ?? undefined,
      };
    } catch {
      return null;
    }
  }

  async infoGrupo(providerSessionId: string, groupJid: string): Promise<{ subject?: string } | null> {
    try {
      const res = await chamarComRetry(
        `/group/findGroupInfos/${providerSessionId}?groupJid=${encodeURIComponent(groupJid)}`,
        { method: "GET" }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      return { subject: (data.subject as string) ?? undefined };
    } catch {
      return null;
    }
  }
}
