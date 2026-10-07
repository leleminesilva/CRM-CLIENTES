import type { CardBrand, InvoiceStatus } from "@prisma/client";
import type { ISODate, MonthKey } from "@fin/lib/dates";
import type { MoneyString } from "@fin/lib/money";

export interface InvoiceSummaryDTO {
  id: string | null;
  referenceMonth: MonthKey;
  closingDate: ISODate;
  dueDate: ISODate;
  status: InvoiceStatus;
  total: MoneyString;
  paid: MoneyString;
  remaining: MoneyString;
  statementAmount: MoneyString | null;
  itemCount: number;
}

export interface CardDTO {
  id: string;
  name: string;
  issuer: string;
  brand: CardBrand;
  lastFour: string | null;
  color: string | null;
  creditLimit: MoneyString;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  archived: boolean;
  /** Compras e parcelas ainda não pagas (inclui parcelas futuras). */
  used: MoneyString;
  available: MoneyString;
  currentInvoice: InvoiceSummaryDTO;
  nextInvoice: InvoiceSummaryDTO;
}

export const BRAND_LABELS: Record<CardBrand, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  ELO: "Elo",
  AMEX: "American Express",
  HIPERCARD: "Hipercard",
  OTHER: "Outra",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PARTIALLY_PAID: "Paga em parte",
  PAID: "Paga",
};
