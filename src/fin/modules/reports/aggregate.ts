import { addMonthsToKey, type MonthKey, monthKeyOf } from "@fin/lib/dates";
import { type Money, sumMoney, toMoney, toMoneyString, ZERO } from "@fin/lib/money";
import type { LedgerRow, ReportCell, ReportChart } from "./types";

const money = (v: Money | string): ReportCell => ({ money: toMoneyString(v) });
const percent = (ratio: Money | null): ReportCell => ({ percent: ratio ? ratio.toFixed(4) : null });

export function monthsBetween(from: string, to: string): MonthKey[] {
  const out: MonthKey[] = [];
  for (let m = monthKeyOf(from); m <= monthKeyOf(to) && out.length < 120; m = addMonthsToKey(m, 1))
    out.push(m);
  return out;
}

const total = (rows: LedgerRow[]) => sumMoney(rows.map((r) => r.amount));
const where = (rows: LedgerRow[], p: (r: LedgerRow) => boolean) => rows.filter(p);

export const CLASS_NAMES = {
  BASE: "Receita principal",
  COMMISSION: "Comissões",
  EXTRA: "Receitas extras",
  OTHER: "Outras",
} as const;
const CLASS_COLORS = {
  BASE: "var(--series-income)",
  COMMISSION: "var(--series-commission)",
  EXTRA: "var(--series-extra)",
  OTHER: "var(--series-other)",
} as const;
const CLASSES = ["BASE", "COMMISSION", "EXTRA", "OTHER"] as const;

/** Receita mensal por classe: Base · Comissões · Renda extra · Outros. */
export function incomeByMonth(rows: LedgerRow[], months: MonthKey[]) {
  const income = where(rows, (r) => r.kind === "INCOME");
  const body = months.map((m) => {
    const inMonth = income.filter((r) => r.month === m);
    const parts = CLASSES.map((c) =>
      total(inMonth.filter((r) => (r.incomeClass ?? "OTHER") === c)),
    );
    return { m, parts, sum: sumMoney(parts) };
  });
  const chart: ReportChart = {
    kind: "monthly",
    stacked: true,
    series: CLASSES.map((c) => ({ key: c, name: CLASS_NAMES[c], color: CLASS_COLORS[c] })),
    data: body.map((b) => ({
      month: b.m,
      ...Object.fromEntries(CLASSES.map((c, i) => [c, b.parts[i]!.toNumber()])),
    })),
  };
  return {
    head: ["Mês", ...CLASSES.map((c) => CLASS_NAMES[c]), "Total"],
    rows: body.map((b) => [b.m, ...b.parts.map(money), money(b.sum)]),
    totals: [
      "Total",
      ...CLASSES.map((_, i) => money(sumMoney(body.map((b) => b.parts[i]!)))),
      money(sumMoney(body.map((b) => b.sum))),
    ] as ReportCell[],
    chart,
  };
}

/** Despesa mensal: fixas × variáveis. */
export function expenseByMonth(rows: LedgerRow[], months: MonthKey[]) {
  const exp = where(rows, (r) => r.kind === "EXPENSE");
  const body = months.map((m) => {
    const inMonth = exp.filter((r) => r.month === m);
    const fixed = total(inMonth.filter((r) => r.nature === "FIXED"));
    const sum = total(inMonth);
    return { m, fixed, variable: sum.minus(fixed), sum };
  });
  return {
    head: ["Mês", "Fixas", "Variáveis", "Total", "% fixas"],
    rows: body.map((b) => [
      b.m,
      money(b.fixed),
      money(b.variable),
      money(b.sum),
      percent(b.sum.isZero() ? null : b.fixed.dividedBy(b.sum)),
    ]),
    totals: (() => {
      const f = sumMoney(body.map((b) => b.fixed));
      const t = sumMoney(body.map((b) => b.sum));
      return [
        "Total",
        money(f),
        money(t.minus(f)),
        money(t),
        percent(t.isZero() ? null : f.dividedBy(t)),
      ] as ReportCell[];
    })(),
    chart: {
      kind: "monthly" as const,
      stacked: true,
      series: [
        { key: "fixed", name: "Fixas", color: "var(--series-expense)" },
        { key: "variable", name: "Variáveis", color: "var(--series-variable)" },
      ],
      data: body.map((b) => ({
        month: b.m,
        fixed: b.fixed.toNumber(),
        variable: b.variable.toNumber(),
      })),
    } satisfies ReportChart,
  };
}

/** Resultado mensal: receitas − despesas e comprometimento da renda. */
export function resultByMonth(rows: LedgerRow[], months: MonthKey[]) {
  const body = months.map((m) => {
    const inMonth = rows.filter((r) => r.month === m);
    const income = total(inMonth.filter((r) => r.kind === "INCOME"));
    const expense = total(inMonth.filter((r) => r.kind === "EXPENSE"));
    return {
      m,
      income,
      expense,
      result: income.minus(expense),
      commit: income.isZero() ? null : expense.dividedBy(income),
    };
  });
  const ti = sumMoney(body.map((b) => b.income));
  const te = sumMoney(body.map((b) => b.expense));
  return {
    head: ["Mês", "Receitas", "Despesas", "Resultado", "Comprometimento"],
    rows: body.map((b) => [
      b.m,
      money(b.income),
      money(b.expense),
      money(b.result),
      percent(b.commit),
    ]),
    totals: [
      "Total",
      money(ti),
      money(te),
      money(ti.minus(te)),
      percent(ti.isZero() ? null : te.dividedBy(ti)),
    ] as ReportCell[],
    chart: {
      kind: "monthly" as const,
      series: [
        { key: "income", name: "Receitas", color: "var(--series-income)" },
        { key: "expense", name: "Despesas", color: "var(--series-expense)" },
      ],
      data: body.map((b) => ({
        month: b.m,
        income: b.income.toNumber(),
        expense: b.expense.toNumber(),
      })),
    } satisfies ReportChart,
  };
}

/** Gastos por categoria (grupo): total, participação e média mensal. */
export function spendingByCategory(rows: LedgerRow[], months: MonthKey[]) {
  const exp = where(rows, (r) => r.kind === "EXPENSE");
  const groups = new Map<string, LedgerRow[]>();
  for (const r of exp) groups.set(r.groupName, [...(groups.get(r.groupName) ?? []), r]);
  const all = total(exp);
  const body = [...groups.entries()]
    .map(([name, list]) => ({ name, sum: total(list), count: list.length }))
    .filter((g) => g.sum.greaterThan(0))
    .sort((a, b) => b.sum.comparedTo(a.sum));
  const n = Math.max(1, months.length);
  return {
    head: ["Categoria", "Total", "% do total", "Média mensal", "Lançamentos"],
    rows: body.map((g) => [
      g.name,
      money(g.sum),
      percent(all.isZero() ? null : g.sum.dividedBy(all)),
      money(g.sum.dividedBy(n)),
      { int: g.count },
    ]),
    totals: [
      "Total",
      money(all),
      percent(all.isZero() ? null : toMoney(1)),
      money(all.dividedBy(n)),
      { int: exp.length },
    ] as ReportCell[],
    chart: {
      kind: "bars" as const,
      items: body.slice(0, 12).map((g) => ({ label: g.name, value: g.sum.toNumber() })),
    } satisfies ReportChart,
  };
}

/** Comissões pagas aos vendedores: prevista, paga e a pagar por mês. */
export function commissionsByMonth(rows: LedgerRow[], months: MonthKey[]) {
  const c = where(rows, (r) => r.kind === "EXPENSE" && r.isCommission);
  const body = months.map((m) => {
    const inMonth = c.filter((r) => r.month === m);
    const sum = total(inMonth);
    const received = total(inMonth.filter((r) => r.settled));
    return { m, sum, received, pending: sum.minus(received) };
  });
  return {
    head: ["Mês", "Prevista", "Paga", "A pagar"],
    rows: body.map((b) => [b.m, money(b.sum), money(b.received), money(b.pending)]),
    totals: [
      "Total",
      money(sumMoney(body.map((b) => b.sum))),
      money(sumMoney(body.map((b) => b.received))),
      money(sumMoney(body.map((b) => b.pending))),
    ] as ReportCell[],
    chart: {
      kind: "monthly" as const,
      series: [{ key: "sum", name: "Comissões", color: "var(--series-commission)" }],
      data: body.map((b) => ({ month: b.m, sum: b.sum.toNumber() })),
    } satisfies ReportChart,
  };
}

/** Comparação entre dois meses, por categoria. */
export function compareMonths(rowsA: LedgerRow[], rowsB: LedgerRow[]) {
  const sums = (rows: LedgerRow[]) => {
    const map = new Map<string, Money>();
    for (const r of rows.filter((x) => x.kind === "EXPENSE"))
      map.set(r.groupName, (map.get(r.groupName) ?? ZERO).plus(r.amount));
    return map;
  };
  const a = sums(rowsA);
  const b = sums(rowsB);
  const names = [...new Set([...a.keys(), ...b.keys()])];
  const body = names
    .map((name) => {
      const va = a.get(name) ?? ZERO;
      const vb = b.get(name) ?? ZERO;
      return {
        name,
        va,
        vb,
        diff: vb.minus(va),
        pct: va.isZero() ? null : vb.minus(va).dividedBy(va),
      };
    })
    .sort((x, y) => y.vb.abs().comparedTo(x.vb.abs()));
  const ta = sumMoney([...a.values()]);
  const tb = sumMoney([...b.values()]);
  return {
    rows: body.map((x) => [x.name, money(x.va), money(x.vb), money(x.diff), percent(x.pct)]),
    totals: [
      "Total de despesas",
      money(ta),
      money(tb),
      money(tb.minus(ta)),
      percent(ta.isZero() ? null : tb.minus(ta).dividedBy(ta)),
    ] as ReportCell[],
    incomeA: total(rowsA.filter((r) => r.kind === "INCOME")),
    incomeB: total(rowsB.filter((r) => r.kind === "INCOME")),
  };
}

/** Comparação entre dois anos, mês a mês. */
export function compareYears(rowsA: LedgerRow[], rowsB: LedgerRow[], yearA: string, yearB: string) {
  const body = Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const at = (rows: LedgerRow[], year: string, kind: "INCOME" | "EXPENSE") =>
      total(rows.filter((r) => r.month === `${year}-${mm}` && r.kind === kind));
    const [ia, ib, ea, eb] = [
      at(rowsA, yearA, "INCOME"),
      at(rowsB, yearB, "INCOME"),
      at(rowsA, yearA, "EXPENSE"),
      at(rowsB, yearB, "EXPENSE"),
    ];
    return { mm, ia, ib, ea, eb };
  });
  const sum = (k: "ia" | "ib" | "ea" | "eb") => sumMoney(body.map((b) => b[k]));
  return {
    rows: body.map((b) => [
      b.mm,
      money(b.ia),
      money(b.ib),
      money(b.ea),
      money(b.eb),
      money(b.ia.minus(b.ea)),
      money(b.ib.minus(b.eb)),
    ]),
    totals: [
      "Total",
      money(sum("ia")),
      money(sum("ib")),
      money(sum("ea")),
      money(sum("eb")),
      money(sum("ia").minus(sum("ea"))),
      money(sum("ib").minus(sum("eb"))),
    ] as ReportCell[],
  };
}
