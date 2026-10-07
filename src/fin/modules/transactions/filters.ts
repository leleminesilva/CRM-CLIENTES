import { first, type SearchParams } from "@fin/lib/month";
import type { TransactionFilters } from "./types";

const TYPES = { receita: "INCOME", despesa: "EXPENSE", transferencia: "TRANSFER" } as const;
const STATUSES = {
  pendente: "PENDING",
  atrasado: "OVERDUE",
  liquidado: "SETTLED",
  cancelado: "CANCELED",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Converte os parâmetros da URL em filtros (valores inválidos são ignorados, nunca quebram a página). */
export function parseFilters(
  month: string,
  sp: SearchParams,
  forced: Partial<TransactionFilters> = {},
): TransactionFilters {
  const tipo = first(sp.tipo) as keyof typeof TYPES | undefined;
  const status = first(sp.status) as keyof typeof STATUSES | undefined;
  const categoria = first(sp.categoria);
  const conta = first(sp.conta);
  const q = first(sp.q)?.slice(0, 80);
  return {
    month,
    type: tipo && tipo in TYPES ? TYPES[tipo] : undefined,
    status: status && status in STATUSES ? STATUSES[status] : undefined,
    categoryId: categoria && UUID.test(categoria) ? categoria : undefined,
    accountId: conta && UUID.test(conta) ? conta : undefined,
    q,
    ...forced,
  };
}
