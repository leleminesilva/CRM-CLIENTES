import { z } from "zod";
import { isoDate } from "@fin/lib/validation";

export const MAX_IMPORT_ROWS = 5000;
export const SOURCES = ["CSV", "XLSX", "OFX"] as const;

export const previewImportSchema = z.object({
  source: z.enum(SOURCES),
  fileName: z.string().trim().max(200),
  accountId: z.string().uuid("Escolha a conta"),
  /** CSV/OFX: texto do arquivo. XLSX: conteúdo em base64. */
  content: z.string().min(1, "O arquivo está vazio").max(12_000_000),
  /** Faturas de cartão trazem compras como valor positivo. */
  invertSign: z.boolean(),
});

export const importRowSchema = z.object({
  date: isoDate(),
  description: z.string().trim().min(1).max(120),
  /** Com sinal: negativo = despesa, positivo = receita. */
  amount: z.string().regex(/^-?\d{1,12}\.\d{2}$/, "Valor inválido"),
  categoryId: z.string().uuid().nullable(),
  externalId: z.string().max(200).nullable(),
});

export const commitImportSchema = z.object({
  source: z.enum(SOURCES),
  fileName: z.string().trim().max(200),
  accountId: z.string().uuid("Escolha a conta"),
  rows: z.array(importRowSchema).min(1, "Nenhuma linha para importar").max(MAX_IMPORT_ROWS),
});

export const rollbackImportSchema = z.object({ id: z.string().uuid() });

export type PreviewImportInput = z.infer<typeof previewImportSchema>;
export type CommitImportInput = z.infer<typeof commitImportSchema>;
