import { addDays, isISODate, type ISODate } from "@fin/lib/dates";
import { formatMoney, parseMoneyInput } from "@fin/lib/money";
import { normalizeText } from "@fin/modules/search/domain/normalize";

export interface QuickEntryOptions {
  today: ISODate;
  categories: { id: string; name: string; kind: "INCOME" | "EXPENSE"; parentName: string | null }[];
  accounts: { id: string; name: string }[];
  cards: { id: string; name: string }[];
}

export interface QuickEntry {
  type: "INCOME" | "EXPENSE";
  /** "250,00" — como o campo do formulário espera. */
  amount: string;
  description: string;
  date: ISODate;
  categoryId: string | null;
  accountId: string | null;
  creditCardId: string | null;
  /** Já pago/recebido: conta (não cartão) e data não futura. */
  settled: boolean;
  /** Frase curta do que foi entendido: "Despesa de R$ 250,00 · Combustível · Nubank". */
  summary: string;
}

const INCOME_WORDS = new Set(["recebi", "receita", "entrada", "ganhei", "salario", "recebimento"]);
const MONEY = /^(r\$)?[+-]?\d[\d.,]*$/i;

/** "5/10", "05/10", "05/10/2026" → ISO no ano de referência (ou do próprio texto). */
function parseDayMonth(token: string, today: ISODate): ISODate | null {
  const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(token);
  if (!m) return null;
  const year = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : today.slice(0, 4);
  const iso = `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return isISODate(iso) ? iso : null;
}

/** Encontra `name` (ou só a primeira palavra, com 3+ letras) como palavras seguidas e devolve o trecho. */
function findNamed<T extends { name: string }>(
  words: string[],
  items: T[],
): { item: T; from: number; length: number } | null {
  let best: { item: T; from: number; length: number } | null = null;
  for (const item of items) {
    const parts = normalizeText(item.name).split(/\s+/);
    const candidates = [parts, parts.slice(0, 1)].filter((p) => p.join("").length >= 3);
    for (const cand of candidates) {
      for (let i = 0; i + cand.length <= words.length; i++) {
        if (cand.every((c, k) => words[i + k] === c) && (!best || cand.length > best.length))
          best = { item, from: i, length: cand.length };
      }
    }
  }
  return best;
}

function findCategory(words: string[], options: QuickEntryOptions, type: QuickEntry["type"]) {
  const pool = options.categories.filter((c) => c.kind === type);
  let best: { id: string; name: string; rank: number } | null = null;
  for (const w of words) {
    if (w.length < 3) continue;
    for (const c of pool) {
      const n = normalizeText(c.name);
      const exact = n === w || n.split(/[\s/]+/).includes(w);
      const prefix = w.length >= 4 && n.startsWith(w);
      const match = exact ? 3 : prefix ? 2 : 0;
      // Em empate, a subcategoria (mais específica) vence.
      const rank = match * 2 + (c.parentName ? 1 : 0);
      if (match > 0 && (best === null || rank > best.rank)) best = { id: c.id, name: c.name, rank };
    }
  }
  return best;
}

/**
 * Entende uma frase curta como lançamento: "250 combustível nubank", "ontem 45,90 mercado itaú",
 * "recebi 1500 freela". Retorna null quando não há um valor. O resultado só preenche o formulário;
 * quem confirma é a pessoa.
 */
export function parseQuickEntry(text: string, options: QuickEntryOptions): QuickEntry | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 12) return null;

  const amountIndex = tokens.findIndex((t) => MONEY.test(t) && !parseDayMonth(t, options.today));
  if (amountIndex < 0) return null;
  const rawAmount = tokens[amountIndex]!;
  const amount = parseMoneyInput(rawAmount.replace(/^\+/, ""));
  if (!amount || amount.isZero()) return null;

  let type: QuickEntry["type"] =
    amount.isNegative() || !rawAmount.startsWith("+") ? "EXPENSE" : "INCOME";
  let date = options.today;
  const rest: string[] = [];
  tokens.forEach((t, i) => {
    if (i === amountIndex) return;
    const n = normalizeText(t);
    if (n === "hoje") return;
    if (n === "ontem") return void (date = addDays(options.today, -1));
    if (n === "anteontem") return void (date = addDays(options.today, -2));
    const d = parseDayMonth(t, options.today);
    if (d) return void (date = d);
    if (INCOME_WORDS.has(n)) return void (type = "INCOME");
    rest.push(t);
  });

  let words = rest.map(normalizeText);
  let original = [...rest];
  const take = (from: number, length: number) => {
    words = [...words.slice(0, from), ...words.slice(from + length)];
    original = [...original.slice(0, from), ...original.slice(from + length)];
  };

  let creditCardId: string | null = null;
  let accountId: string | null = null;
  let where: string | null = null;
  const card = type === "EXPENSE" ? findNamed(words, options.cards) : null;
  if (card) {
    creditCardId = card.item.id;
    where = card.item.name;
    take(card.from, card.length);
  } else {
    const account = findNamed(words, options.accounts);
    if (account) {
      accountId = account.item.id;
      where = account.item.name;
      take(account.from, account.length);
    }
  }

  const category = findCategory(words, options, type);
  const description =
    original.join(" ").trim() || category?.name || (type === "INCOME" ? "Receita" : "Despesa");
  const label = type === "INCOME" ? "Receita" : "Despesa";
  return {
    type,
    amount: amount.abs().toFixed(2).replace(".", ","),
    description: description.charAt(0).toUpperCase() + description.slice(1),
    date,
    categoryId: category?.id ?? null,
    accountId,
    creditCardId,
    settled: creditCardId === null && date <= options.today,
    summary: [`${label} de ${formatMoney(amount.abs())}`, category?.name, where]
      .filter(Boolean)
      .join(" · "),
  };
}
