import type { ISODate } from "@fin/lib/dates";
import type { ServiceContext } from "@fin/lib/permissions";

export interface Insight {
  id: string;
  text: string;
  tone: "neutral" | "positive" | "warning";
  href?: string;
}

/**
 * Fonte de insights. Hoje: regras (RuleInsightProvider). Amanhã: um provider de IA que recebe
 * agregados anonimizados (nunca o extrato bruto) e devolve o mesmo formato.
 */
export interface InsightProvider {
  name: string;
  generate(ctx: ServiceContext, today: ISODate): Promise<Insight[]>;
}
