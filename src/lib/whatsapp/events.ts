import { randomUUID } from "crypto";

// Pipeline de eventos em processo (síncrono, dentro da mesma requisição — não
// é fila distribuída). O envelope estruturado é o que permite trocar por uma
// fila real depois sem mudar quem emite ou quem escuta. Ver
// docs/architecture/whatsapp.md.

export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: string;
  occurredAt: Date;
  correlationId: string;
  payload: T;
}

type Handler<T = unknown> = (event: DomainEvent<T>) => void | Promise<void>;

const handlers = new Map<string, Handler[]>();

export function on<T = unknown>(eventType: string, handler: Handler<T>): void {
  const lista = handlers.get(eventType) ?? [];
  lista.push(handler as Handler);
  handlers.set(eventType, lista);
}

export async function emit<T = unknown>(eventType: string, payload: T, correlationId: string): Promise<void> {
  const event: DomainEvent<T> = {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date(),
    correlationId,
    payload,
  };
  const lista = handlers.get(eventType) ?? [];
  for (const handler of lista) {
    await handler(event);
  }
}
