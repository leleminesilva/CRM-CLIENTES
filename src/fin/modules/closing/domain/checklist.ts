export interface ClosingFacts {
  month: string;
  currentMonth: string;
  pending: { count: number; overdue: number };
  uncategorized: number;
  openInvoices: number;
  pendingCommissions: number;
}

export interface ChecklistItem {
  id: "period" | "pending" | "categories" | "invoices" | "commissions";
  ok: boolean;
  title: string;
  detail: string;
  href: string | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Conferências automáticas antes de fechar o mês. Nenhuma bloqueia: avisam, quem decide é a pessoa. */
export function buildChecklist(f: ClosingFacts): ChecklistItem[] {
  const unfinished = f.month >= f.currentMonth;
  return [
    {
      id: "period",
      ok: !unfinished,
      title: unfinished ? "O mês ainda não terminou" : "Mês encerrado",
      detail: unfinished
        ? "Fechar agora congela totais parciais. O ideal é fechar a partir do primeiro dia do mês seguinte."
        : "Todos os dias do mês já passaram.",
      href: null,
    },
    {
      id: "pending",
      ok: f.pending.count === 0,
      title:
        f.pending.count === 0
          ? "Nada pendente"
          : `${plural(f.pending.count, "lançamento pendente", "lançamentos pendentes")}`,
      detail:
        f.pending.count === 0
          ? "Tudo o que vencia no mês foi pago ou recebido."
          : `${plural(f.pending.overdue, "está atrasado", "estão atrasados")}. Marque como pago ou ajuste a data.`,
      href: f.pending.count === 0 ? null : `/financeiro/lancamentos?mes=${f.month}&status=pendente`,
    },
    {
      id: "categories",
      ok: f.uncategorized === 0,
      title:
        f.uncategorized === 0
          ? "Tudo categorizado"
          : plural(f.uncategorized, "lançamento sem categoria", "lançamentos sem categoria"),
      detail:
        f.uncategorized === 0
          ? "Os relatórios por categoria estão completos."
          : "Sem categoria, o gasto some dos relatórios e do orçamento.",
      href: f.uncategorized === 0 ? null : `/financeiro/lancamentos?mes=${f.month}`,
    },
    {
      id: "invoices",
      ok: f.openInvoices === 0,
      title:
        f.openInvoices === 0
          ? "Faturas em dia"
          : plural(f.openInvoices, "fatura em aberto", "faturas em aberto"),
      detail:
        f.openInvoices === 0
          ? "Nenhuma fatura do mês ficou sem pagamento."
          : "Registre o pagamento ou confira o valor com o banco.",
      href: f.openInvoices === 0 ? null : "/financeiro/cartoes",
    },
    {
      id: "commissions",
      ok: f.pendingCommissions === 0,
      title:
        f.pendingCommissions === 0
          ? "Comissões recebidas"
          : plural(f.pendingCommissions, "comissão a receber", "comissões a receber"),
      detail:
        f.pendingCommissions === 0
          ? "Todas as comissões do mês foram recebidas."
          : "Confirme com o cliente ou marque como recebida.",
      href: f.pendingCommissions === 0 ? null : `/financeiro/comissoes?mes=${f.month}`,
    },
  ];
}
