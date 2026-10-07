export interface ParsedRow {
  /** Linha no arquivo (1 = primeira linha de dados), para mensagens de erro. */
  line: number;
  date: string;
  description: string;
  /** Com sinal: negativo = saída, positivo = entrada. "-123.45". */
  amount: string;
  /** FITID do OFX ou outro identificador estável do banco. */
  externalId: string | null;
}

export interface RowError {
  line: number;
  reason: string;
}

export interface ParseOutcome {
  rows: ParsedRow[];
  errors: RowError[];
}
