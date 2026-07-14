import prisma from "@/lib/prisma";
import { maskPhone } from "./masks";

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * A Meta às vezes entrega o "from" do webhook sem o 9º dígito do celular
 * brasileiro (ex: "554796386714" em vez de "5547996386714") — um bug
 * conhecido da Cloud API com números do Brasil. Como só celular tem
 * WhatsApp, qualquer "55" + DDD + 8 dígitos (12 no total) é sempre esse
 * caso, nunca um fixo legítimo. Reinserimos o "9" para que o número fique
 * válido para o envio de mensagens de volta.
 */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = normalizePhone(raw);
  if (digits.startsWith("55") && digits.length === 12) {
    return `55${digits.slice(2, 4)}9${digits.slice(4)}`;
  }
  return digits;
}

/**
 * Formats a raw WhatsApp phone number (which includes the "55" country code,
 * e.g. "5547999998888") into the same "(47) 99999-8888" shape used
 * everywhere else in the app, so bot-created clients look consistent.
 */
export function formatBrazilianPhone(raw: string): string {
  const digits = normalizePhone(raw);
  const semDDI = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return maskPhone(semDDI);
}

/**
 * Finds an existing (non-deleted) Cliente whose telefone or whatsapp matches
 * the given phone number, comparing digits only so formatting differences
 * (e.g. "(47) 99999-8888" vs a raw WhatsApp number) don't cause a miss.
 */
export async function findClienteByPhone(phone: string) {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return null;

  const suffix = digits.slice(-4);
  const candidatos = await prisma.cliente.findMany({
    where: {
      deletedAt: null,
      OR: [
        { telefone: { endsWith: suffix } },
        { whatsapp: { endsWith: suffix } },
      ],
    },
  });

  return (
    candidatos.find((c) => {
      const telefoneDigits = c.telefone ? normalizePhone(c.telefone) : "";
      const whatsappDigits = c.whatsapp ? normalizePhone(c.whatsapp) : "";
      return telefoneDigits.endsWith(digits) || whatsappDigits.endsWith(digits) ||
        digits.endsWith(telefoneDigits) || digits.endsWith(whatsappDigits);
    }) ?? null
  );
}
