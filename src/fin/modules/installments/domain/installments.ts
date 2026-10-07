import { addMonths, clampedDate, type ISODate, parseISODate } from "@fin/lib/dates";
import { type Money, splitEvenly } from "@fin/lib/money";
import { resolveInvoice } from "@fin/modules/credit-cards/domain/invoice-cycle";

export interface InstallmentInput {
  totalAmount: string;
  count: number;
  /** Parcelas já pagas antes de usar o sistema: não geram lançamentos. */
  priorPaidCount: number;
  purchaseDate: ISODate;
  /** Para cartão: dias de fechamento e vencimento. Sem cartão: use firstDueDate. */
  card?: { closingDay: number; dueDay: number };
  /** Vencimento da 1ª parcela (boleto, carnê). Obrigatório sem cartão. */
  firstDueDate?: ISODate;
}

export interface PlannedInstallment {
  number: number;
  amount: Money;
  /** Data da parcela (para cartão, a "data da compra" correspondente àquele mês). */
  date: ISODate;
  dueDate: ISODate;
}

/**
 * Gera as parcelas restantes (regra R4). Centavos de diferença vão para a 1ª parcela. No cartão,
 * a parcela k cai na fatura da 1ª + (k − 1) meses e vence no dia de vencimento do cartão.
 */
export function planInstallments(input: InstallmentInput): PlannedInstallment[] {
  const { count, priorPaidCount } = input;
  if (!Number.isInteger(count) || count < 1 || count > 420)
    throw new RangeError("Número de parcelas inválido.");
  if (!Number.isInteger(priorPaidCount) || priorPaidCount < 0 || priorPaidCount >= count) {
    throw new RangeError("As parcelas já pagas precisam ser menos que o total.");
  }
  const amounts = splitEvenly(input.totalAmount, count);
  const firstDue = input.card
    ? resolveInvoice(input.purchaseDate, input.card.closingDay, input.card.dueDay).dueDate
    : input.firstDueDate;
  if (!firstDue) throw new RangeError("Informe o vencimento da primeira parcela.");

  const planned: PlannedInstallment[] = [];
  for (let number = priorPaidCount + 1; number <= count; number++) {
    const dueDate = input.card
      ? // Mantém o dia de vencimento do cartão ao somar meses (31 → último dia).
        addMonthsKeepingDay(firstDue, number - 1, input.card.dueDay)
      : addMonths(firstDue, number - 1);
    planned.push({
      number,
      amount: amounts[number - 1]!,
      date: input.card ? addMonths(input.purchaseDate, number - 1) : dueDate,
      dueDate,
    });
  }
  return planned;
}

function addMonthsKeepingDay(from: ISODate, months: number, day: number): ISODate {
  const { year, month } = parseISODate(from);
  const index = year * 12 + (month - 1) + months;
  return clampedDate(Math.floor(index / 12), (index % 12) + 1, day);
}
