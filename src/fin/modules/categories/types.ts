import type { CategoryKind, ExpenseNature, IncomeClass } from "@prisma/client";

export interface CategoryDTO {
  id: string;
  kind: CategoryKind;
  parentId: string | null;
  name: string;
  icon: string;
  color: string;
  incomeClass: IncomeClass | null;
  defaultNature: ExpenseNature | null;
  isEssential: boolean;
  isSystem: boolean;
  archived: boolean;
  sortOrder: number;
  /** Lançamentos que usam a categoria (para avisar antes de excluir). */
  usage: number;
}

export interface CategoryNode extends CategoryDTO {
  children: CategoryDTO[];
}

export const INCOME_CLASS_LABELS: Record<IncomeClass, string> = {
  BASE: "Base (salário)",
  COMMISSION: "Comissões",
  EXTRA: "Renda extra",
  OTHER: "Outros",
};

export const NATURE_LABELS: Record<ExpenseNature, string> = {
  FIXED: "Fixa",
  VARIABLE: "Variável",
};
