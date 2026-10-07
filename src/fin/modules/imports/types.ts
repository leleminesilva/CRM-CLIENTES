import type { RowError } from "./domain/types";

export interface PreviewRow {
  line: number;
  date: string;
  description: string;
  amount: string;
  externalId: string | null;
  type: "INCOME" | "EXPENSE";
  /** Já existe um lançamento igual: vem desmarcada na revisão. */
  duplicate: boolean;
  duplicateReason: "id" | "match" | null;
  /** Categoria sugerida pelo histórico (mesma descrição). */
  categoryId: string | null;
}

export interface ImportPreview {
  rows: PreviewRow[];
  errors: RowError[];
  stats: { read: number; fresh: number; duplicates: number; errors: number };
}

export interface ImportBatchDTO {
  id: string;
  source: "CSV" | "XLSX" | "OFX" | "OPEN_FINANCE";
  fileName: string | null;
  accountName: string | null;
  status: "DRAFT" | "COMMITTED" | "ROLLED_BACK" | "FAILED";
  stats: { read: number; imported: number; duplicates: number };
  liveCount: number;
  createdAt: string;
}
