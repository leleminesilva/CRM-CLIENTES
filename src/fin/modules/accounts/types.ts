import type { AccountType } from "@prisma/client";
import type { ISODate } from "@fin/lib/dates";
import type { MoneyString } from "@fin/lib/money";

export interface AccountDTO {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  color: string | null;
  initialBalance: MoneyString;
  initialBalanceDate: ISODate;
  isLiquid: boolean;
  includeInNetWorth: boolean;
  archived: boolean;
  sortOrder: number;
  /** Saldo atual calculado (saldo inicial + lançamentos liquidados). */
  balance: MoneyString;
  /** Quantidade de lançamentos ligados (para avisar antes de excluir). */
  transactionCount: number;
  /** Lançamentos pagos antes da data do saldo inicial (fora do saldo). null quando não há. */
  beforeStart: { count: number; earliest: ISODate } | null;
}

export interface AccountsSummary {
  /** Contas líquidas ativas: o "saldo disponível" do painel. */
  available: MoneyString;
  /** Contas de investimento ativas. */
  invested: MoneyString;
  /** Contas que entram no patrimônio. */
  netWorthTotal: MoneyString;
  /** Lançamentos fora do saldo nas contas ativas (anteriores ao saldo inicial). */
  beforeStartCount: number;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  WALLET: "Dinheiro",
  INVESTMENT: "Investimentos",
  BENEFIT: "Vale-benefício",
  OTHER: "Outra",
};

/** Padrões por tipo: vale e investimento não são "dinheiro disponível". */
export const ACCOUNT_TYPE_DEFAULTS: Record<
  AccountType,
  { isLiquid: boolean; includeInNetWorth: boolean }
> = {
  CHECKING: { isLiquid: true, includeInNetWorth: true },
  SAVINGS: { isLiquid: true, includeInNetWorth: true },
  WALLET: { isLiquid: true, includeInNetWorth: true },
  INVESTMENT: { isLiquid: false, includeInNetWorth: true },
  BENEFIT: { isLiquid: false, includeInNetWorth: false },
  OTHER: { isLiquid: true, includeInNetWorth: true },
};
