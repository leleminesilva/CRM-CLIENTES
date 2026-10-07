import type { Money } from "@fin/lib/money";
import type { DisplayStatus } from "@fin/modules/transactions/domain/status";

/** Célula de relatório: o valor cru vale para exportar; a formatação é feita na exibição. */
export type ReportCell =
  string | { money: string } | { percent: string | null } | { int: number } | null;

export interface ReportChart {
  kind: "monthly" | "bars";
  stacked?: boolean;
  series?: { key: string; name: string; color: string }[];
  data?: ({ month: string } & Record<string, number | string>)[];
  items?: { label: string; value: number }[];
}

export interface ReportResult {
  id: string;
  title: string;
  description: string;
  head: string[];
  rows: ReportCell[][];
  /** Linha de totais (opcional). */
  totals?: ReportCell[];
  chart?: ReportChart;
  /** Os filtros da barra se aplicam a este relatório? */
  filterable: boolean;
  note?: string;
}

export interface ReportFilters {
  from: string;
  to: string;
  type?: "INCOME" | "EXPENSE" | undefined;
  status?: DisplayStatus | undefined;
  categoryId?: string | undefined;
  accountId?: string | undefined;
  cardId?: string | undefined;
  /** Parâmetros dos comparativos. */
  monthA?: string | undefined;
  monthB?: string | undefined;
  yearA?: string | undefined;
  yearB?: string | undefined;
}

export interface LedgerRow {
  date: string;
  month: string;
  /** EXPENSE (inclui estornos como valor negativo) ou INCOME. */
  kind: "INCOME" | "EXPENSE";
  /** Valor com sinal para somar: despesa positiva, estorno negativo, receita positiva. */
  amount: Money;
  settled: boolean;
  displayStatus: DisplayStatus;
  nature: "FIXED" | "VARIABLE" | null;
  groupId: string | null;
  groupName: string;
  categoryName: string;
  incomeClass: "BASE" | "COMMISSION" | "EXTRA" | "OTHER" | null;
  accountName: string | null;
  cardName: string | null;
  isInstallment: boolean;
}
