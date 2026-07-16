import type { WhatsAppProvider } from "@prisma/client";
import type { IWhatsAppProvider } from "./types";
import { EvolutionProvider } from "./evolution";

// Mapa simples de provider → implementação. Adicionar um provider novo é
// registrar aqui, nada mais — ver docs/architecture/whatsapp.md.
const providers: Partial<Record<WhatsAppProvider, () => IWhatsAppProvider>> = {
  EVOLUTION: () => new EvolutionProvider(),
};

export function getProvider(provider: WhatsAppProvider): IWhatsAppProvider {
  const factory = providers[provider];
  if (!factory) throw new Error(`Provider "${provider}" não implementado`);
  return factory();
}

export type { IWhatsAppProvider } from "./types";
export type {
  ProviderCapabilities,
  MensagemPayload,
  NormalizedMedia,
  NormalizedMessage,
  NormalizedReceipt,
  NormalizedSession,
  NormalizedWebhookEvent,
} from "./types";
