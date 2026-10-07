import { isISODate } from "@fin/lib/dates";
import { parseMoneyInput } from "@fin/lib/money";
import { normalizeText } from "@fin/modules/search/domain/normalize";
import type { ParseOutcome } from "./types";

/** "05/10/2026", "5/10/26", "2026-10-05" → ISO; qualquer outra coisa → null. */
export function parseFlexibleDate(raw: string): string | null {
  const s = raw.trim().replace(/\s.*$/, "");
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return isISODate(s) ? s : null;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
  const iso = `${year}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  return isISODate(iso) ? iso : null;
}

const DATE_NAMES = ["data", "date", "dt", "data lancamento", "data da compra", "data compra"];
const DESC_NAMES = [
  "descricao",
  "historico",
  "description",
  "memo",
  "estabelecimento",
  "lancamento",
  "detalhes",
  "titulo",
];
const AMOUNT_NAMES = ["valor", "amount", "montante", "value", "valor (r$)"];
const DEBIT_NAMES = ["debito", "saida", "saidas"];
const CREDIT_NAMES = ["credito", "entrada", "entradas"];
const ID_NAMES = ["id", "identificador", "fitid", "documento", "codigo"];

export interface ColumnMap {
  date: number;
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  id: number | null;
}

function find(header: string[], names: string[]): number | null {
  const norm = header.map(normalizeText);
  for (const n of names) {
    const i = norm.indexOf(n);
    if (i >= 0) return i;
  }
  const loose = norm.findIndex((h) => names.some((n) => h.includes(n)));
  return loose >= 0 ? loose : null;
}

/** Descobre as colunas pelo cabeçalho. null quando faltar data, descrição ou valor. */
export function detectColumns(header: string[]): ColumnMap | null {
  const date = find(header, DATE_NAMES);
  const description = find(header, DESC_NAMES);
  const amount = find(header, AMOUNT_NAMES);
  const debit = find(header, DEBIT_NAMES);
  const credit = find(header, CREDIT_NAMES);
  if (date === null || description === null) return null;
  if (amount === null && (debit === null || credit === null)) return null;
  return { date, description, amount, debit, credit, id: find(header, ID_NAMES) };
}

/**
 * Converte uma tabela (primeira linha = cabeçalho) em linhas de importação.
 * `invert`: faturas de cartão trazem compras como valor positivo — inverte o sinal.
 */
export function rowsFromTable(
  table: string[][],
  invert = false,
): ParseOutcome & { headerFound: boolean } {
  const [header, ...data] = table;
  const map = header ? detectColumns(header) : null;
  if (!header || !map) return { rows: [], errors: [], headerFound: false };
  const out: ParseOutcome = { rows: [], errors: [] };
  data.forEach((cells, index) => {
    const line = index + 1;
    const date = parseFlexibleDate(cells[map.date] ?? "");
    const description = (cells[map.description] ?? "").trim().slice(0, 120);
    let amount = null as ReturnType<typeof parseMoneyInput>;
    if (map.amount !== null) amount = parseMoneyInput(cells[map.amount] ?? "");
    else {
      const d = parseMoneyInput(cells[map.debit!] ?? "");
      const c = parseMoneyInput(cells[map.credit!] ?? "");
      amount = d && !d.isZero() ? d.abs().negated() : c && !c.isZero() ? c.abs() : null;
    }
    if (!date)
      return void out.errors.push({ line, reason: `Data inválida: "${cells[map.date] ?? ""}".` });
    if (!description) return void out.errors.push({ line, reason: "Descrição vazia." });
    if (!amount || amount.isZero())
      return void out.errors.push({
        line,
        reason: `Valor inválido: "${cells[map.amount ?? map.debit!] ?? ""}".`,
      });
    out.rows.push({
      line,
      date,
      description,
      amount: (invert ? amount.negated() : amount).toFixed(2),
      externalId: map.id !== null ? (cells[map.id] ?? "").trim() || null : null,
    });
  });
  return { ...out, headerFound: true };
}
