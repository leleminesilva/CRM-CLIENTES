import {
  addMonthsToKey,
  firstDayOfMonth,
  isISODate,
  isMonthKey,
  lastDayOfMonth,
  monthKeyOf,
  type ISODate,
} from "@fin/lib/dates";
import { first, type SearchParams } from "@fin/lib/month";
import type { ServiceContext } from "@fin/lib/permissions";
import { sumMoney, toMoneyString } from "@fin/lib/money";
import { listCards } from "@fin/modules/credit-cards/queries";
import { INVOICE_STATUS_LABELS } from "@fin/modules/credit-cards/types";
import { listPlans } from "@fin/modules/installments/queries";
import { netWorthHistory } from "@fin/modules/net-worth/queries";
import { listSubscriptions } from "@fin/modules/subscriptions/queries";
import * as agg from "./aggregate";
import { loadLedger } from "./ledger";
import type { ReportCell, ReportFilters, ReportResult } from "./types";

export interface ReportMeta {
  id: string;
  title: string;
  description: string;
  group:
    "Receitas e despesas" | "Planejamento" | "Cartões e dívidas" | "Comparações" | "Patrimônio";
  filterable: boolean;
}

export const REPORTS: ReportMeta[] = [
  {
    id: "receita-mensal",
    title: "Receita mensal",
    description: "Receita principal, comissões, receitas extras e outras, mês a mês.",
    group: "Receitas e despesas",
    filterable: true,
  },
  {
    id: "despesa-mensal",
    title: "Despesa mensal",
    description: "Quanto você gasta por mês, separando fixas e variáveis.",
    group: "Receitas e despesas",
    filterable: true,
  },
  {
    id: "resultado-mensal",
    title: "Resultado mensal",
    description: "Receitas − despesas e quanto da renda foi comprometida.",
    group: "Receitas e despesas",
    filterable: true,
  },
  {
    id: "gastos-por-categoria",
    title: "Gastos por categoria",
    description: "Para onde o dinheiro vai, em ordem, com participação e média mensal.",
    group: "Receitas e despesas",
    filterable: true,
  },
  {
    id: "fixas-vs-variaveis",
    title: "Gastos fixos vs variáveis",
    description: "O peso das despesas que se repetem sobre o total.",
    group: "Receitas e despesas",
    filterable: true,
  },
  {
    id: "comissoes",
    title: "Comissões",
    description: "Comissões pagas aos vendedores: previstas, pagas e a pagar por mês.",
    group: "Receitas e despesas",
    filterable: true,
  },
  {
    id: "parcelamentos",
    title: "Parcelamentos",
    description: "Cada compra parcelada: parcelas pagas, saldo devedor e quando termina.",
    group: "Cartões e dívidas",
    filterable: false,
  },
  {
    id: "cartoes",
    title: "Cartões",
    description: "Limite, utilizado, disponível e faturas de cada cartão.",
    group: "Cartões e dívidas",
    filterable: false,
  },
  {
    id: "assinaturas",
    title: "Assinaturas",
    description: "Custo mensal e anual dos serviços recorrentes.",
    group: "Cartões e dívidas",
    filterable: false,
  },
  {
    id: "comparacao-meses",
    title: "Comparação entre meses",
    description: "Despesas por categoria em dois meses, com a variação.",
    group: "Comparações",
    filterable: false,
  },
  {
    id: "comparacao-anos",
    title: "Comparação entre anos",
    description: "Receitas, despesas e resultado de dois anos, mês a mês.",
    group: "Comparações",
    filterable: false,
  },
  {
    id: "evolucao-patrimonial",
    title: "Evolução patrimonial",
    description: "Ativos, passivos e patrimônio líquido ao fim de cada mês.",
    group: "Patrimônio",
    filterable: false,
  },
];

const STATUSES = {
  pendente: "PENDING",
  atrasado: "OVERDUE",
  liquidado: "SETTLED",
  cancelado: "CANCELED",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filtros da URL → filtros validados (inválido é ignorado). Padrão: últimos 12 meses até o fim do mês atual. */
export function parseReportFilters(sp: SearchParams, today: ISODate): ReportFilters {
  const current = monthKeyOf(today);
  const de = first(sp.de);
  const ate = first(sp.ate);
  const tipo = first(sp.tipo);
  const status = first(sp.status) as keyof typeof STATUSES | undefined;
  const cat = first(sp.categoria);
  const conta = first(sp.conta);
  const cartao = first(sp.cartao);
  const mesA = first(sp.mesa);
  const mesB = first(sp.mesb);
  const anoA = first(sp.anoa);
  const anoB = first(sp.anob);
  let from = de && isISODate(de) ? de : firstDayOfMonth(addMonthsToKey(current, -11));
  let to = ate && isISODate(ate) ? ate : lastDayOfMonth(current);
  if (to < from) [from, to] = [to, from];
  return {
    from,
    to,
    type: tipo === "receita" ? "INCOME" : tipo === "despesa" ? "EXPENSE" : undefined,
    status: status && status in STATUSES ? STATUSES[status] : undefined,
    categoryId: cat && UUID.test(cat) ? cat : undefined,
    accountId: conta && UUID.test(conta) ? conta : undefined,
    cardId: cartao && UUID.test(cartao) ? cartao : undefined,
    monthA: mesA && isMonthKey(mesA) ? mesA : addMonthsToKey(current, -1),
    monthB: mesB && isMonthKey(mesB) ? mesB : current,
    yearA: anoA && /^\d{4}$/.test(anoA) ? anoA : String(Number(current.slice(0, 4)) - 1),
    yearB: anoB && /^\d{4}$/.test(anoB) ? anoB : current.slice(0, 4),
  };
}

const money = (v: string): ReportCell => ({ money: v });

export async function runReport(
  ctx: ServiceContext,
  id: string,
  f: ReportFilters,
  today: ISODate,
): Promise<ReportResult | null> {
  const meta = REPORTS.find((r) => r.id === id);
  if (!meta) return null;
  const base = {
    id,
    title: meta.title,
    description: meta.description,
    filterable: meta.filterable,
  };

  if (
    [
      "receita-mensal",
      "despesa-mensal",
      "resultado-mensal",
      "gastos-por-categoria",
      "fixas-vs-variaveis",
      "comissoes",
    ].includes(id)
  ) {
    const rows = await loadLedger(ctx, f, today);
    const months = agg.monthsBetween(f.from, f.to);
    switch (id) {
      case "receita-mensal":
        return { ...base, ...agg.incomeByMonth(rows, months) };
      case "despesa-mensal":
      case "fixas-vs-variaveis":
        return { ...base, ...agg.expenseByMonth(rows, months) };
      case "resultado-mensal":
        return { ...base, ...agg.resultByMonth(rows, months) };
      case "gastos-por-categoria":
        return { ...base, ...agg.spendingByCategory(rows, months) };
      default:
        return { ...base, ...agg.commissionsByMonth(rows, months) };
    }
  }

  if (id === "parcelamentos") {
    const plans = await listPlans(ctx, { includeFinished: true });
    return {
      ...base,
      head: ["Compra", "Pago com", "Parcelas", "Valor da parcela", "Saldo devedor", "Termina em"],
      rows: plans.map((p) => [
        p.description,
        p.card?.name ?? p.account?.name ?? "Boleto/carnê",
        `${p.paidCount}/${p.installmentCount}`,
        money(p.installmentAmount),
        money(p.outstanding),
        p.lastDueDate ? monthKeyOf(p.lastDueDate) : null,
      ]),
      totals: [
        "Total",
        "",
        "",
        "",
        money(
          toMoneyString(
            sumMoney(plans.filter((p) => p.status === "ACTIVE").map((p) => p.outstanding)),
          ),
        ),
        "",
      ],
    };
  }
  if (id === "cartoes") {
    const cards = await listCards(ctx, today);
    return {
      ...base,
      head: [
        "Cartão",
        "Limite",
        "Utilizado",
        "Disponível",
        "Fatura atual",
        "Situação",
        "Próxima fatura",
      ],
      rows: cards.map((c) => [
        c.name,
        money(c.creditLimit),
        money(c.used),
        money(c.available),
        money(c.currentInvoice.total),
        INVOICE_STATUS_LABELS[c.currentInvoice.status],
        money(c.nextInvoice.total),
      ]),
      totals: [
        "Total",
        money(toMoneyString(sumMoney(cards.map((c) => c.creditLimit)))),
        money(toMoneyString(sumMoney(cards.map((c) => c.used)))),
        money(toMoneyString(sumMoney(cards.map((c) => c.available)))),
        money(toMoneyString(sumMoney(cards.map((c) => c.currentInvoice.total)))),
        "",
        money(toMoneyString(sumMoney(cards.map((c) => c.nextInvoice.total)))),
      ],
    };
  }
  if (id === "assinaturas") {
    const s = await listSubscriptions(ctx, today);
    return {
      ...base,
      head: ["Serviço", "Cobrança", "Valor", "Custo mensal", "Custo anual", "Situação"],
      rows: s.items.map((i) => [
        i.name,
        i.billingLabel,
        money(i.amount),
        money(i.monthlyCost),
        money(i.yearlyCost),
        i.status === "ACTIVE" ? "Ativa" : i.status === "PAUSED" ? "Pausada" : "Cancelada",
      ]),
      totals: ["Total (ativas)", "", "", money(s.monthlyTotal), money(s.yearlyTotal), ""],
    };
  }
  if (id === "comparacao-meses") {
    const a = f.monthA!;
    const b = f.monthB!;
    const range = (m: string) => ({
      ...f,
      from: firstDayOfMonth(m),
      to: lastDayOfMonth(m),
      type: undefined,
      status: undefined,
      categoryId: undefined,
      accountId: undefined,
      cardId: undefined,
    });
    const [ra, rb] = await Promise.all([
      loadLedger(ctx, range(a), today),
      loadLedger(ctx, range(b), today),
    ]);
    const c = agg.compareMonths(ra, rb);
    return {
      ...base,
      title: `Comparação: ${a} × ${b}`,
      head: ["Categoria", a, b, "Diferença", "Variação"],
      rows: c.rows,
      totals: c.totals,
      note: `Receitas: ${a} = R$ ${toMoneyString(c.incomeA)} · ${b} = R$ ${toMoneyString(c.incomeB)}.`,
    };
  }
  if (id === "comparacao-anos") {
    const ya = f.yearA!;
    const yb = f.yearB!;
    const range = (y: string) => ({
      ...f,
      from: `${y}-01-01`,
      to: `${y}-12-31`,
      type: undefined,
      status: undefined,
      categoryId: undefined,
      accountId: undefined,
      cardId: undefined,
    });
    const [ra, rb] = await Promise.all([
      loadLedger(ctx, range(ya), today),
      loadLedger(ctx, range(yb), today),
    ]);
    const c = agg.compareYears(ra, rb, ya, yb);
    return {
      ...base,
      title: `Comparação: ${ya} × ${yb}`,
      head: [
        "Mês",
        `Receitas ${ya}`,
        `Receitas ${yb}`,
        `Despesas ${ya}`,
        `Despesas ${yb}`,
        `Resultado ${ya}`,
        `Resultado ${yb}`,
      ],
      rows: c.rows,
      totals: c.totals,
    };
  }
  // evolução patrimonial
  const history = await netWorthHistory(ctx, today, 24);
  return {
    ...base,
    head: ["Mês", "Ativos", "Passivos", "Patrimônio líquido"],
    rows: history.map((h) => [h.month, money(h.assets), money(h.liabilities), money(h.netWorth)]),
    chart: {
      kind: "monthly",
      series: [{ key: "netWorth", name: "Patrimônio líquido", color: "var(--series-income)" }],
      data: history.map((h) => ({ month: h.month, netWorth: Number(h.netWorth) })),
    },
  };
}
