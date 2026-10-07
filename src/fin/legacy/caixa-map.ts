import type {
  AccountType,
  CategoryKind,
  ExpenseNature,
  FinanceiroContaTipo,
  FinanceiroTipoLancamento,
  IncomeClass,
} from "@prisma/client";

// Regras puras de conversão do Caixa antigo (financeiro_*) para o Financeiro novo (fin_*).
// Sem banco aqui: tudo testável isoladamente.

export const LEGACY_TIMEZONE = "America/Sao_Paulo";

export const ACCOUNT_TYPE: Record<FinanceiroContaTipo, AccountType> = {
  CAIXA: "WALLET",
  CORRENTE: "CHECKING",
  POUPANCA: "SAVINGS",
  INVESTIMENTO: "INVESTMENT",
  // Cartão de crédito no sistema novo é um cadastro à parte (Cartões), não uma conta.
  CARTAO: "OTHER",
};

export const KIND: Record<FinanceiroTipoLancamento, CategoryKind> = {
  ENTRADA: "INCOME",
  SAIDA: "EXPENSE",
};

/**
 * A coluna `data` do Caixa antigo mistura dois formatos:
 * - lançamento digitado na tela: `new Date("2026-09-16")` → meia-noite UTC exata, o dia é o UTC;
 * - combustível do carro: `new Date()` → horário real, o dia é o de Brasília.
 * Converter a meia-noite UTC para Brasília jogaria o lançamento para o dia anterior.
 */
export function legacyDateToISO(date: Date, timezone = LEGACY_TIMEZONE): string {
  const utcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;
  if (utcMidnight) return date.toISOString().slice(0, 10);
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(date);
}

/** Coluna DATE do Postgres a partir de "YYYY-MM-DD" (meia-noite UTC, como o Prisma grava DATE). */
export function isoToDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** O sistema novo grava cor como hex de 7 caracteres; o antigo aceitava qualquer texto até 20. */
export function normalizeColor(color: string | null | undefined): string | null {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

interface CategoryHint {
  icon: string;
  incomeClass?: IncomeClass;
  defaultNature?: ExpenseNature;
  isEssential?: boolean;
}

// Categorias que o Caixa antigo cria por padrão. Chave sem acento e em minúsculas.
const CATEGORY_HINTS: Record<string, CategoryHint> = {
  vendas: { icon: "banknote", incomeClass: "BASE" },
  servicos: { icon: "wrench", incomeClass: "BASE" },
  "outras receitas": { icon: "ellipsis", incomeClass: "OTHER" },
  fornecedores: { icon: "building", defaultNature: "VARIABLE" },
  salarios: { icon: "wallet", defaultNature: "FIXED", isEssential: true },
  aluguel: { icon: "key-round", defaultNature: "FIXED", isEssential: true },
  impostos: { icon: "landmark", defaultNature: "FIXED", isEssential: true },
  marketing: { icon: "sparkles", defaultNature: "VARIABLE" },
  "outras despesas": { icon: "ellipsis", defaultNature: "VARIABLE" },
  combustivel: { icon: "fuel", defaultNature: "VARIABLE", isEssential: true },
};

const DEFAULT_COLOR: Record<CategoryKind, string> = { INCOME: "#1baf7a", EXPENSE: "#6b7a73" };

export interface CategoryAttributes {
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  incomeClass: IncomeClass | null;
  defaultNature: ExpenseNature | null;
  isEssential: boolean;
}

/** Atributos de uma categoria nova a partir da antiga (ícone, classe e natureza por nome). */
export function categoryAttributes(
  nome: string,
  tipo: FinanceiroTipoLancamento,
  cor: string | null,
): CategoryAttributes {
  const kind = KIND[tipo];
  const hint = CATEGORY_HINTS[nameKey(nome)];
  return {
    kind,
    name: nome.trim(),
    icon: hint?.icon ?? (kind === "INCOME" ? "banknote" : "receipt"),
    color: normalizeColor(cor) ?? DEFAULT_COLOR[kind],
    incomeClass: kind === "INCOME" ? (hint?.incomeClass ?? "OTHER") : null,
    defaultNature: kind === "EXPENSE" ? (hint?.defaultNature ?? "VARIABLE") : null,
    isEssential: hint?.isEssential ?? false,
  };
}

/** Nome livre entre os já usados ("Caixa", "Caixa (2)", ...): conta tem nome único no workspace. */
export function uniqueName(name: string, taken: Set<string>): string {
  const base = name.trim();
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
