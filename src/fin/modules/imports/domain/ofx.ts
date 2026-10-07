import { parseMoneyInput } from "@fin/lib/money";
import { isISODate } from "@fin/lib/dates";
import type { ParseOutcome } from "./types";

const tag = (block: string, name: string): string | null => {
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? decodeEntities(m[1]!.trim()) : null;
};
const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

/** "20261005120000[-3:BRT]" → "2026-10-05". */
export function ofxDate(raw: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  return isISODate(iso) ? iso : null;
}

/**
 * Extrai os lançamentos (<STMTTRN>) de um OFX 1.x (SGML) ou 2.x (XML).
 * TRNAMT já vem com sinal: negativo = saída.
 */
export function parseOfx(content: string): ParseOutcome {
  const rows: ParseOutcome["rows"] = [];
  const errors: ParseOutcome["errors"] = [];
  const blocks =
    content.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) ?? [];
  blocks.forEach((block, index) => {
    const line = index + 1;
    const date = ofxDate(tag(block, "DTPOSTED") ?? "");
    const amount = parseMoneyInput((tag(block, "TRNAMT") ?? "").replace(/^\+/, ""));
    const description = (tag(block, "MEMO") ?? tag(block, "NAME") ?? "").slice(0, 120);
    if (!date) return void errors.push({ line, reason: "Data inválida (DTPOSTED)." });
    if (!amount || amount.isZero())
      return void errors.push({ line, reason: "Valor inválido (TRNAMT)." });
    if (!description) return void errors.push({ line, reason: "Sem descrição (MEMO/NAME)." });
    rows.push({
      line,
      date,
      description,
      amount: amount.toFixed(2),
      externalId: tag(block, "FITID"),
    });
  });
  return { rows, errors };
}
