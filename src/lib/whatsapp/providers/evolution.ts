import { createHash } from "crypto";
import type {
  IWhatsAppProvider,
  ProviderCapabilities,
  MensagemPayload,
  NormalizedWebhookEvent,
} from "./types";
import type { WhatsAppSessaoStatus } from "@prisma/client";

// Implementação concreta contra a Evolution API (https://github.com/EvolutionAPI/evolution-api).
// Único arquivo do sistema que conhece o formato de request/response dela — ver
// docs/architecture/whatsapp.md. Os paths/payloads abaixo seguem o contrato conhecido
// da Evolution API v2, mas ainda não foram verificados contra uma instância real rodando
// (isso acontece na Fase 2/5, quando a VPS existir) — ajustar aqui, e só aqui, se divergir.

const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

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
      if (key?.fromMe) return []; // eco da própria mensagem enviada, já persistida no envio
      const message = data.message as Record<string, unknown> | undefined;
      const conteudo =
        (message?.conversation as string) ?? (message?.extendedTextMessage as { text?: string })?.text ?? "";
      return [
        {
          schemaVersion: 1,
          providerEventId,
          type: "message",
          data: {
            providerMessageId: (key?.id as string) ?? providerEventId,
            fromPhone: ((key?.remoteJid as string) ?? "").replace(/@.*/, ""),
            tipo: "texto",
            conteudo,
            timestamp: new Date(Number(data.messageTimestamp ?? Date.now() / 1000) * 1000),
            contatoNome: data.pushName as string | undefined,
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
}
