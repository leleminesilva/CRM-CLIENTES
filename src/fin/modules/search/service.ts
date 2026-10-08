import { Prisma } from "@prisma/client";
import { formatDate, fromDbDate, monthKeyOf } from "@fin/lib/dates";
import { prisma } from "@fin/lib/db";
import { parseMoneyInput, toMoneyString } from "@fin/lib/money";
import type { ServiceContext } from "@fin/lib/permissions";
import { score } from "./domain/normalize";
import type { SearchHit, SearchResult } from "./types";

const PER_KIND = 5;
const MIN_LENGTH = 2;

const cut = (q: string) => q.trim().slice(0, 60);
/** Escapa % _ \ para o LIKE. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Valor digitado como dinheiro ("250", "1.234,56", "R$ 90") → busca por valor exato. */
function amountOf(q: string): string | null {
  if (!/^(R\$\s*)?\d[\d.,]*$/i.test(q.trim())) return null;
  const v = parseMoneyInput(q);
  return v && v.greaterThan(0) ? v.toFixed(2) : null;
}

/**
 * Busca global do workspace ativo: lançamentos, comissões, parcelamentos e cadastros.
 * Sem acento e por trecho (índices trigram); número vira busca por valor.
 */
export async function searchAll(ctx: ServiceContext, raw: string): Promise<SearchResult> {
  const query = cut(raw);
  if (query.length < MIN_LENGTH) return { query, hits: [] };
  const amount = amountOf(query);
  const esc = likeEscape(query);
  const ws = ctx.workspaceId;

  const [tx, commissions, plans, accounts, cards, categories, goals, subs, assets, liabilities] =
    await Promise.all([
      prisma.$queryRaw<
        {
          id: string;
          description: string;
          type: "INCOME" | "EXPENSE" | "TRANSFER" | "REFUND";
          amount: string;
          due_date: Date;
          category: string | null;
        }[]
      >(Prisma.sql`
        SELECT t.id, t.description, t.type, t.amount::text AS amount, t.due_date, c.name AS category
        FROM fin_transactions t LEFT JOIN fin_categories c ON c.id = t.category_id
        WHERE t.workspace_id = ${ws}::uuid AND t.deleted_at IS NULL
          AND t.type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'REFUND') AND t.is_balance_adjustment = false
          AND (fin_immutable_unaccent(lower(t.description)) LIKE '%' || fin_immutable_unaccent(lower(${esc})) || '%' ESCAPE '\\'
               ${amount ? Prisma.sql`OR t.amount = ${amount}::numeric` : Prisma.empty})
        ORDER BY t.due_date DESC LIMIT ${PER_KIND}`),
      prisma.$queryRaw<
        {
          id: string;
          seller_name: string;
          amount: string;
          sale_date: Date;
        }[]
      >(Prisma.sql`
        SELECT cm.id, cm.seller_name, t.amount::text AS amount, cm.sale_date
        FROM fin_commissions cm JOIN fin_transactions t ON t.id = cm.transaction_id
        WHERE cm.workspace_id = ${ws}::uuid AND cm.deleted_at IS NULL
          AND fin_immutable_unaccent(lower(cm.seller_name))
              LIKE '%' || fin_immutable_unaccent(lower(${esc})) || '%' ESCAPE '\\'
        ORDER BY cm.sale_date DESC LIMIT ${PER_KIND}`),
      prisma.$queryRaw<{ id: string; description: string; total: string; n: number }[]>(Prisma.sql`
        SELECT id, description, total_amount::text AS total, installment_count AS n
        FROM fin_installment_plans
        WHERE workspace_id = ${ws}::uuid AND deleted_at IS NULL
          AND fin_immutable_unaccent(lower(description)) LIKE '%' || fin_immutable_unaccent(lower(${esc})) || '%' ESCAPE '\\'
        ORDER BY created_at DESC LIMIT ${PER_KIND}`),
      prisma.account.findMany({
        where: { workspaceId: ws, archivedAt: null },
        select: { id: true, name: true, institution: true },
      }),
      prisma.creditCard.findMany({
        where: { workspaceId: ws, archivedAt: null },
        select: { id: true, name: true, lastFour: true },
      }),
      prisma.category.findMany({
        where: { workspaceId: ws, archivedAt: null },
        select: { id: true, name: true, kind: true, parent: { select: { name: true } } },
      }),
      prisma.goal.findMany({
        where: { workspaceId: ws },
        select: { id: true, name: true, targetAmount: true },
      }),
      prisma.subscription.findMany({
        where: { workspaceId: ws },
        select: { id: true, name: true, provider: true, status: true },
      }),
      prisma.asset.findMany({
        where: { workspaceId: ws, archivedAt: null },
        select: { id: true, name: true },
      }),
      prisma.liability.findMany({
        where: { workspaceId: ws, archivedAt: null },
        select: { id: true, name: true },
      }),
    ]);

  const hits: SearchHit[] = [];
  const top = <T>(list: T[], text: (x: T) => string) =>
    list
      .map((x) => ({ x, s: score(text(x), query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, PER_KIND)
      .map((r) => r.x);

  for (const r of tx) {
    const due = fromDbDate(r.due_date);
    const flow =
      r.type === "INCOME" || r.type === "REFUND" ? "in" : r.type === "EXPENSE" ? "out" : null;
    hits.push({
      id: r.id,
      kind: "transaction",
      title: r.description,
      subtitle: [formatDate(due), r.category ?? (r.type === "TRANSFER" ? "Transferência" : null)]
        .filter(Boolean)
        .join(" · "),
      amount: toMoneyString(r.amount),
      flow,
      href: `/financeiro/lancamentos?mes=${monthKeyOf(due)}&q=${encodeURIComponent(r.description)}`,
    });
  }
  for (const r of commissions)
    hits.push({
      id: r.id,
      kind: "commission",
      title: r.seller_name || "Sem vendedor",
      subtitle: `Comissão · ${formatDate(fromDbDate(r.sale_date))}`,
      amount: toMoneyString(r.amount),
      flow: "out",
      href: `/financeiro/comissoes?mes=${monthKeyOf(fromDbDate(r.sale_date))}`,
    });
  for (const r of plans)
    hits.push({
      id: r.id,
      kind: "installment",
      title: r.description,
      subtitle: `${r.n}x`,
      amount: toMoneyString(r.total),
      flow: "out",
      href: "/financeiro/parcelamentos",
    });
  for (const a of top(accounts, (x) => `${x.name} ${x.institution ?? ""}`))
    hits.push({
      id: a.id,
      kind: "account",
      title: a.name,
      subtitle: a.institution ?? "Conta",
      amount: null,
      flow: null,
      href: `/financeiro/contas/${a.id}`,
    });
  for (const c of top(cards, (x) => `${x.name} ${x.lastFour ?? ""}`))
    hits.push({
      id: c.id,
      kind: "card",
      title: c.name,
      subtitle: c.lastFour ? `final ${c.lastFour}` : "Cartão",
      amount: null,
      flow: null,
      href: `/financeiro/cartoes/${c.id}`,
    });
  for (const c of top(categories, (x) => x.name))
    hits.push({
      id: c.id,
      kind: "category",
      title: c.name,
      subtitle: [c.parent?.name, c.kind === "INCOME" ? "Receita" : "Despesa"]
        .filter(Boolean)
        .join(" · "),
      amount: null,
      flow: null,
      href: `/financeiro/lancamentos?categoria=${c.id}`,
    });
  for (const g of top(goals, (x) => x.name))
    hits.push({
      id: g.id,
      kind: "goal",
      title: g.name,
      subtitle: "Meta",
      amount: toMoneyString(g.targetAmount),
      flow: null,
      href: "/financeiro/metas",
    });
  for (const s of top(subs, (x) => `${x.name} ${x.provider ?? ""}`))
    hits.push({
      id: s.id,
      kind: "subscription",
      title: s.name,
      subtitle: s.provider ?? "Assinatura",
      amount: null,
      flow: null,
      href: "/financeiro/assinaturas",
    });
  for (const a of top(assets, (x) => x.name))
    hits.push({
      id: a.id,
      kind: "asset",
      title: a.name,
      subtitle: "Bem",
      amount: null,
      flow: null,
      href: "/financeiro/patrimonio",
    });
  for (const l of top(liabilities, (x) => x.name))
    hits.push({
      id: l.id,
      kind: "liability",
      title: l.name,
      subtitle: "Dívida",
      amount: null,
      flow: null,
      href: "/financeiro/patrimonio",
    });

  return { query, hits };
}
