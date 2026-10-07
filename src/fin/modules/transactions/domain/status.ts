import type { TransactionStatus, TransactionType } from "@prisma/client";
import type { ISODate } from "@fin/lib/dates";

/** Status exibido: "atrasado" é calculado (pendente com vencimento antes de hoje), nunca gravado. */
export type DisplayStatus = "SETTLED" | "PENDING" | "OVERDUE" | "CANCELED";

export function displayStatus(
  status: TransactionStatus,
  dueDate: ISODate,
  today: ISODate,
): DisplayStatus {
  if (status === "CANCELED") return "CANCELED";
  if (status === "SETTLED") return "SETTLED";
  return dueDate < today ? "OVERDUE" : "PENDING";
}

const LABELS: Record<"in" | "out" | "move", Record<DisplayStatus, string>> = {
  in: { SETTLED: "Recebido", PENDING: "Previsto", OVERDUE: "Atrasado", CANCELED: "Cancelado" },
  out: { SETTLED: "Pago", PENDING: "A pagar", OVERDUE: "Vencido", CANCELED: "Cancelado" },
  move: { SETTLED: "Realizada", PENDING: "Agendada", OVERDUE: "Atrasada", CANCELED: "Cancelada" },
};

export function directionOf(type: TransactionType): "in" | "out" | "move" {
  if (type === "INCOME" || type === "REFUND") return "in";
  if (type === "TRANSFER") return "move";
  return "out";
}

export function statusLabel(type: TransactionType, status: DisplayStatus): string {
  return LABELS[directionOf(type)][status];
}

/** Verbo da ação de liquidar, por tipo: "Marcar como paga", "Marcar como recebida". */
export function settleActionLabel(type: TransactionType): string {
  return directionOf(type) === "in"
    ? "Marcar como recebido"
    : directionOf(type) === "move"
      ? "Marcar como realizada"
      : "Marcar como pago";
}

export const TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
  REFUND: "Estorno",
  TRANSFER: "Transferência",
  CARD_PAYMENT: "Pagamento de fatura",
};
