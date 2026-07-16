import type { WhatsAppSessaoStatus } from "@prisma/client";

// Contrato do provider e DTOs normalizados. Nada específico de um gateway
// (Evolution, WPPConnect, Meta, etc.) pode vazar pra fora deste arquivo —
// ver docs/architecture/whatsapp.md.

export interface ProviderCapabilities {
  supportsReadReceipt: boolean;
  supportsTyping: boolean;
  supportsMedia: boolean;
  supportsGroup: boolean;
  supportsReaction: boolean;
  supportsStatus: boolean;
}

export interface NormalizedMedia {
  url?: string;
  base64?: string;
  mimeType: string;
  filename?: string;
}

export type MensagemPayload =
  | { tipo: "texto"; conteudo: string }
  | { tipo: "imagem" | "video" | "audio" | "documento"; media: NormalizedMedia; legenda?: string };

export interface NormalizedMessage {
  providerMessageId: string;
  fromPhone: string;
  tipo: "texto" | "imagem" | "video" | "audio" | "documento";
  conteudo?: string;
  media?: NormalizedMedia;
  timestamp: Date;
  contatoNome?: string;
}

export interface NormalizedReceipt {
  providerMessageId: string;
  status: "entregue" | "lida" | "falhou";
  timestamp: Date;
}

export interface NormalizedSession {
  providerSessionId: string;
  status: WhatsAppSessaoStatus;
  qrCode?: string;
  numero?: string;
}

export type NormalizedWebhookEvent = {
  schemaVersion: 1;
  providerEventId: string;
} & (
  | { type: "message"; data: NormalizedMessage }
  | { type: "receipt"; data: NormalizedReceipt }
  | { type: "session"; data: NormalizedSession }
);

export interface IWhatsAppProvider {
  readonly capabilities: ProviderCapabilities;

  createSession(nome: string): Promise<{ providerSessionId: string; providerVersion?: string }>;
  getQrCode(providerSessionId: string): Promise<{ qrCode: string | null; status: WhatsAppSessaoStatus }>;
  getStatus(providerSessionId: string): Promise<WhatsAppSessaoStatus>;
  disconnect(providerSessionId: string): Promise<void>;
  restart(providerSessionId: string): Promise<void>;
  deleteSession(providerSessionId: string): Promise<void>;
  sendMessage(
    providerSessionId: string,
    toPhone: string,
    payload: MensagemPayload
  ): Promise<{ providerMessageId: string }>;
  parseWebhook(rawBody: unknown): NormalizedWebhookEvent[];
}
