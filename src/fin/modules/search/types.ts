export type SearchKind =
  | "transaction"
  | "commission"
  | "installment"
  | "subscription"
  | "account"
  | "card"
  | "category"
  | "goal"
  | "asset"
  | "liability";

export interface SearchHit {
  id: string;
  kind: SearchKind;
  title: string;
  /** Linha de apoio já formatada (data, categoria…). */
  subtitle: string;
  /** Valor em "1234.56" quando faz sentido mostrar. */
  amount: string | null;
  /** Despesa/renda: define o sinal visual. */
  flow: "in" | "out" | null;
  href: string;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
}

export const SEARCH_KIND_LABEL: Record<SearchKind, string> = {
  transaction: "Lançamentos",
  commission: "Comissões",
  installment: "Parcelamentos",
  subscription: "Assinaturas",
  account: "Contas",
  card: "Cartões",
  category: "Categorias",
  goal: "Metas",
  asset: "Bens",
  liability: "Dívidas",
};
