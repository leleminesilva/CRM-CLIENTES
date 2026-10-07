import type {
  ExpenseNature,
  PaymentMethod,
  TransactionStatus,
  TransactionType,
} from "@prisma/client";
import type { ISODate } from "@fin/lib/dates";
import type { MoneyString } from "@fin/lib/money";
import type { DisplayStatus } from "./domain/status";

export interface TransactionDTO {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  displayStatus: DisplayStatus;
  description: string;
  notes: string | null;
  amount: MoneyString;
  date: ISODate;
  dueDate: ISODate;
  settledAt: ISODate | null;
  account: { id: string; name: string; color: string | null } | null;
  transferAccount: { id: string; name: string; color: string | null } | null;
  category: {
    id: string;
    name: string;
    icon: string;
    color: string;
    parentName: string | null;
  } | null;
  nature: ExpenseNature | null;
  paymentMethod: PaymentMethod | null;
  recurrenceId: string | null;
  isRecurrenceOverride: boolean;
  installment: { number: number; count: number } | null;
  creditCard: { id: string; name: string } | null;
  isBalanceAdjustment: boolean;
  attachmentCount: number;
  /** Só lançamentos do livro-caixa podem ser editados aqui (não pagamentos de fatura, por exemplo). */
  editable: boolean;
  /** Receita gerada por uma comissão: editar e excluir pela tela de Comissões. */
  commissionId: string | null;
}

export interface MoneySplit {
  total: MoneyString;
  settled: MoneyString;
  pending: MoneyString;
  overdue: MoneyString;
}

export interface MonthTotals {
  income: MoneySplit;
  expense: MoneySplit;
  /** Receitas − despesas (previsto total). */
  result: MoneyString;
  /** Receitas recebidas − despesas pagas. */
  settledResult: MoneyString;
}

export interface TransactionFilters {
  month: string;
  type?: "INCOME" | "EXPENSE" | "TRANSFER" | undefined;
  status?: DisplayStatus | undefined;
  categoryId?: string | undefined;
  nature?: "FIXED" | "VARIABLE" | undefined;
  accountId?: string | undefined;
  q?: string | undefined;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  PIX: "Pix",
  DEBIT_CARD: "Cartão de débito",
  CREDIT_CARD: "Cartão de crédito",
  BOLETO: "Boleto",
  BANK_TRANSFER: "Transferência (TED)",
  AUTO_DEBIT: "Débito automático",
  CASH: "Dinheiro",
  BENEFIT_CARD: "Vale-refeição/alimentação",
  OTHER: "Outro",
};
