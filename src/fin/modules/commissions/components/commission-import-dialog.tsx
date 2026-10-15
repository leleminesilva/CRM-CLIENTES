"use client";

import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@fin/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@fin/components/ui/dialog";
import { Field } from "@fin/components/ui/field";
import { Input } from "@fin/components/ui/input";
import { handleActionResult } from "@fin/lib/action-result";
import { addDays, type ISODate } from "@fin/lib/dates";
import { formatMoney } from "@fin/lib/money";
import { computeCommission } from "../domain/commission";
import { importCommissionsAction } from "../actions";

interface Row {
  budget: string;
  amount: string;
  client: string;
  seller: string;
}

interface Parsed {
  rows: Row[];
  /** Linhas puladas por falta de dado, com o número da linha na planilha. */
  invalid: { line: number; reason: string }[];
  error: string | null;
}

/** Divide o CSV em linhas/colunas respeitando aspas ("R$ 1.500,00" tem vírgula dentro). */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const first = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!;
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) out.push(row);
  return out;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

/** "R$ 7.500,00" → "7500.00"; também aceita "7500.00" e "7500,5". */
function parseAmount(raw: string): string | null {
  let v = raw.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!v) return null;
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  else if ((v.match(/\./g)?.length ?? 0) > 1) v = v.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n.toFixed(2) : null;
}

function parseSheet(text: string): Parsed {
  const table = parseCsv(text);
  const header = table[0]?.map(norm) ?? [];
  const col = {
    budget: header.findIndex((h) => h.includes("orcamento")),
    amount: header.findIndex((h) => h === "valor" || h === "comissao"),
    client: header.findIndex((h) => h === "cliente"),
    seller: header.findIndex((h) => h === "responsavel" || h === "vendedor"),
  };
  const missing = (
    [
      ["N° Orçamento", col.budget],
      ["Valor", col.amount],
      ["Cliente", col.client],
      ["Responsável", col.seller],
    ] as const
  )
    .filter(([, i]) => i < 0)
    .map(([n]) => n);
  if (missing.length > 0)
    return {
      rows: [],
      invalid: [],
      error: `Não encontrei a coluna ${missing.join(", ")}. A primeira linha precisa ter: N° Orçamento, valor, Cliente e Responsável.`,
    };
  const rows: Row[] = [];
  const invalid: Parsed["invalid"] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const budget = (cells[col.budget] ?? "").trim();
    const client = (cells[col.client] ?? "").trim();
    const seller = (cells[col.seller] ?? "").trim();
    const amount = parseAmount(cells[col.amount] ?? "");
    if (!budget || !client || !seller) invalid.push({ line, reason: "falta orçamento, cliente ou responsável" });
    else if (!amount) invalid.push({ line, reason: `valor inválido (${cells[col.amount] ?? ""})` });
    else rows.push({ budget, amount, client, seller });
  });
  return { rows, invalid, error: rows.length === 0 ? "Nenhuma linha válida na planilha." : null };
}

async function readFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf); // planilhas do Excel em português
  }
}

export function CommissionImportDialog({
  open,
  onOpenChange,
  today,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  today: ISODate;
}) {
  const [parsed, setParsed] = React.useState<Parsed | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [expectedDate, setExpectedDate] = React.useState<string>(addDays(today, 30));
  const [rate, setRate] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const rateNumber = Number.parseFloat(rate.replace(",", "."));
  const rateValid = rateNumber > 0 && rateNumber <= 100;

  /** Venda e comissão por linha (a comissão é arredondada em centavos, igual ao servidor). */
  const calc = React.useMemo(() => {
    const rows = (parsed?.rows ?? []).map((r) => ({
      ...r,
      commission: rateValid ? Number(computeCommission(r.amount, rateNumber.toString())) : null,
    }));
    const sale = rows.reduce((s, r) => s + Number(r.amount), 0);
    const commission = rateValid ? rows.reduce((s, r) => s + (r.commission ?? 0), 0) : null;
    const map = new Map<string, { sale: number; commission: number; n: number }>();
    for (const r of rows) {
      const cur = map.get(r.seller) ?? { sale: 0, commission: 0, n: 0 };
      map.set(r.seller, {
        sale: cur.sale + Number(r.amount),
        commission: cur.commission + (r.commission ?? 0),
        n: cur.n + 1,
      });
    }
    return { sale, commission, bySeller: [...map.entries()].sort((a, b) => b[1].sale - a[1].sale) };
  }, [parsed, rateValid, rateNumber]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setParsed(parseSheet(await readFile(file)));
  }

  async function onImport() {
    if (!parsed || parsed.rows.length === 0 || !rateValid) return;
    setBusy(true);
    try {
      const result = await importCommissionsAction({ expectedDate, ratePercent: rate, rows: parsed.rows });
      if (handleActionResult(result)) {
        const d = result?.data;
        toast.success(
          d && d.skipped > 0
            ? `${d.created} comissões importadas, ${d.skipped} já existiam`
            : `${d?.created ?? parsed.rows.length} comissões importadas`,
        );
        onOpenChange(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Importar comissões de uma planilha</DialogTitle>
          <DialogDescription>
            CSV com as colunas N° Orçamento, valor (da venda), Cliente e Responsável. Cada linha vira
            uma comissão a pagar ao responsável (vendedor): valor × percentual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-card border border-dashed border-line-strong bg-surface px-4 py-3 hover:bg-surface-sunken">
            <FileSpreadsheetIcon className="size-5 text-ink-3" />
            <span className="grid gap-0.5 text-sm">
              <span className="font-medium">{fileName || "Escolher o arquivo CSV"}</span>
              <span className="text-xs text-ink-3">
                {fileName ? "Clique para trocar o arquivo" : "Arquivo .csv exportado da planilha"}
              </span>
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>

          {parsed?.error ? (
            <p role="alert" className="text-sm text-critical">
              {parsed.error}
            </p>
          ) : null}

          {parsed && parsed.rows.length > 0 ? (
            <>
              <div className="grid gap-1 rounded-card bg-surface-sunken px-3 py-2.5 text-sm">
                <span className="font-medium">
                  {parsed.rows.length} vendas · {formatMoney(calc.sale.toFixed(2))}
                  {calc.commission !== null
                    ? ` → comissão ${formatMoney(calc.commission.toFixed(2))}`
                    : ""}
                </span>
                <ul className="grid gap-0.5 text-[13px] text-ink-2">
                  {calc.bySeller.map(([seller, v]) => (
                    <li key={seller} className="flex justify-between gap-3">
                      <span className="truncate">
                        {seller} <span className="text-ink-3">({v.n})</span>
                      </span>
                      <span className="nums">
                        {calc.commission !== null
                          ? formatMoney(v.commission.toFixed(2))
                          : formatMoney(v.sale.toFixed(2))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {parsed.invalid.length > 0 ? (
                <p className="text-[13px] text-ink-2">
                  {parsed.invalid.length} linha(s) ignorada(s):{" "}
                  {parsed.invalid
                    .slice(0, 4)
                    .map((x) => `linha ${x.line} (${x.reason})`)
                    .join("; ")}
                  {parsed.invalid.length > 4 ? "…" : ""}
                </p>
              ) : null}
              <Field
                label="Percentual da comissão (%)"
                hint="Aplicado sobre o valor de cada linha da planilha."
              >
                {(a) => (
                  <Input
                    {...a}
                    inputMode="decimal"
                    placeholder="Ex.: 5"
                    autoFocus
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Previsão de pagamento"
                hint="Vale para todas as comissões desta planilha."
              >
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                )}
              </Field>
              <p className="text-xs text-ink-3">
                Se importar o mesmo arquivo de novo, as linhas que já existem são puladas.
              </p>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => void onImport()}
            disabled={busy || !parsed || parsed.rows.length === 0 || !expectedDate || !rateValid}
          >
            <UploadIcon />
            {busy ? "Importando…" : `Importar ${parsed?.rows.length ?? 0} comissões`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
