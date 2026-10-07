import type { ChecklistItem } from "./domain/checklist";

export interface ClosingSummary {
  income: string;
  expense: string;
  result: string;
  /** Resultado ÷ receitas, "0.2500". null sem receitas. */
  savingsRate: string | null;
  netWorth: string;
  topCategory: { name: string; amount: string } | null;
}

export interface ClosingReview {
  month: string;
  checklist: ChecklistItem[];
  /** Totais ao vivo (mês aberto) ou congelados (mês fechado). */
  summary: ClosingSummary;
  previous: { income: string; expense: string; result: string };
  closed: { closedAt: string; notes: string | null } | null;
}

export interface ClosingHistoryItem {
  month: string;
  closedAt: string;
  result: string;
  netWorth: string;
}
