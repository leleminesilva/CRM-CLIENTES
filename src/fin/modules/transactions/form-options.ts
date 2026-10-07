import type { AccountType } from "@prisma/client";
import type { CategoryNode } from "@fin/modules/categories/types";

/** Dados de apoio dos formulários de lançamento (carregados uma vez no layout). */
export interface FormOptions {
  cards: { id: string; name: string; color: string | null; closingDay: number; dueDay: number }[];
  accounts: { id: string; name: string; type: AccountType; color: string | null }[];
  categories: { income: CategoryNode[]; expense: CategoryNode[] };
}
